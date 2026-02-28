import rison from "rison";

type RisonValue = string | number | boolean | null | RisonValue[] | { [key: string]: RisonValue };

/**
 * Parses and manipulates Kibana/OpenSearch Discover URLs.
 *
 * Kibana URLs use a hash-based routing with rison-encoded parameters:
 *
 *   http://kibana:5601/app/discover#/?_a=(...)&_g=(...)&_q=(...)
 *   |   base URL      |    path      |     hash params          |
 *
 * Hash params (rison-encoded):
 *   _a  — App state: query, filters, columns, sort, data source, etc.
 *         Example: _a=(query:(language:kuery,query:'host:"server-1"'),filters:!(),columns:!())
 *   _g  — Global state: time range (from/to), refresh interval
 *         Example: _g=(time:(from:now-15m,to:now),refreshInterval:(pause:!t,value:60000))
 *   _q  — Query state (OpenSearch): mirrors _a.query for OpenSearch Dashboards compatibility
 *
 * Single document page has a different hash path:
 *   #/doc/<dataViewId>/<indexName>?id=<docId>&_g=(...)
 *   — contains doc-specific params like "id" that are not valid for Discover
 *
 * Rison is a compact JSON-like encoding used by Kibana in URL hash params.
 * Example: (key:value,list:!(a,b)) is equivalent to {"key":"value","list":["a","b"]}
 */
export class KibanaURL {
  private static last: {
    url: string;
    instance: KibanaURL;
  };

  private rawUrl: string;
  private url: URL;
  private hash: string;
  private hashPath: string;
  private hashParams: string | undefined;
  private hashParamsObj: Record<string, RisonValue>;

  constructor(url: string) {
    this.rawUrl = url;
    this.url = new URL(url);
    this.hash = this.url.hash;

    // Hash is not URL-encoded and contains a path + rison-encoded params
    // e.g. "#/?_a=(query:...)&_g=(time:...)" → path="#/", params="_a=(...)&_g=(...)"
    const [hashPath, hashParams] = this.hash.split("?", 2);
    this.hashPath = hashPath;
    this.hashParams = hashParams;
    this.hashParamsObj = this.parseHashParams(this.hashParams);
  }

  /**
   * Return KibanaURL instance from current URL. It caches last instance to avoid
   * unnecessary parsing of URL when it's not changed
   */
  static fromCurrentURL(): KibanaURL {
    const currentUrl = window.location.href;
    if (this.last?.url === currentUrl) {
      return this.last.instance;
    }

    const url = new KibanaURL(window.location.href);
    this.last = {
      url: currentUrl,
      instance: url,
    };
    return url;
  }

  /** Parse "key1=rison1&key2=rison2" into {key1: decoded1, key2: decoded2} */
  parseHashParams(hashParams: string | undefined): Record<string, RisonValue> {
    if (hashParams === undefined) {
      return {};
    }
    const params = hashParams.split("&");
    const result: Record<string, RisonValue> = {};
    params.forEach((param) => {
      const [key, value] = param.split("=", 2);
      result[key] = rison.decode(value) as RisonValue;
    });
    return result;
  }

  /**
   * Set the KQL query
   *
   * Produces the structure Kibana expects:
   *   _a.query = { language: "kuery", query: 'field:"value"' }
   *   _q.query = { language: "kuery", query: 'field:"value"' }
   *
   * When preserveQuery is true, appends to the existing query with AND:
   *   'existing query AND field:"value"'
   */
  private setHashParamsQuery(
    params: Record<string, RisonValue>,
    options: {
      name: string;
      value: string;
      preserveQuery?: boolean;
    },
  ): Record<string, RisonValue> {
    const newQuery = `${options.name}:"${options.value}"`;

    // _a — app state (used by Kibana)
    const a = ((params["_a"] as Record<string, RisonValue>) ??= {});
    const existingAQuery = options.preserveQuery
      ? ((a["query"] as Record<string, RisonValue> | undefined)?.["query"] as string | undefined)
      : undefined;
    a["query"] = {
      language: "kuery",
      query: existingAQuery ? `${existingAQuery} AND ${newQuery}` : newQuery,
    };

    // _q — query state (used by OpenSearch Dashboards)
    const q = ((params["_q"] as Record<string, RisonValue>) ??= {});
    const existingQQuery = options.preserveQuery
      ? ((q["query"] as Record<string, RisonValue> | undefined)?.["query"] as string | undefined)
      : undefined;
    q["query"] = {
      language: "kuery",
      query: existingQQuery ? `${existingQQuery} AND ${newQuery}` : newQuery,
    };

    return params;
  }

  /** Check if current page is a single document view (#/doc/<dataViewId>/<index>) */
  private isDocPage(): boolean {
    return this.hashPath.startsWith("#/doc/");
  }

  /** Encode params back to "key1=rison1&key2=rison2" format */
  toHashParamsString(hashParams: Record<string, RisonValue>): string {
    return Object.entries(hashParams)
      .map(([key, value]) => {
        return `${key}=${rison.encode(value)}`;
      })
      .join("&");
  }

  /**
   * Build a new Discover URL with the given field:value as a KQL query.
   * Does not mutate object state — returns a new URL string.
   *
   * On single doc pages (#/doc/...), redirects to Discover (#/) and strips
   * doc-specific params (e.g. "id") that would be invalid on the Discover page.
   */
  withQuery(options: {
    name: string;
    value: string;
    preserveFilters?: boolean;
    preserveDateRange?: boolean;
    preserveColumns?: boolean;
    preserveQuery?: boolean;
  }): string {
    // To avoid mutation of previous hash params clone it
    let prevHashParams = structuredClone(this.hashParamsObj);

    // On single document page, strip doc-specific params (e.g. "id")
    // and only keep Discover-relevant params
    if (this.isDocPage()) {
      const clean: Record<string, RisonValue> = {};
      for (const key of ["_a", "_g", "_q"]) {
        if (key in prevHashParams) clean[key] = prevHashParams[key];
      }
      prevHashParams = clean;
    }

    // Set new query
    const newHashParamsObj = this.setHashParamsQuery(prevHashParams, {
      name: options.name,
      value: options.value,
      preserveQuery: options.preserveQuery,
    });

    // Strip _a sub-keys (filters, columns) and _g (global/time state) based on settings
    if (!options.preserveFilters) {
      const a = newHashParamsObj["_a"] as Record<string, RisonValue> | undefined;
      if (a) delete a["filters"];
    }
    if (!options.preserveColumns) {
      const a = newHashParamsObj["_a"] as Record<string, RisonValue> | undefined;
      if (a) delete a["columns"];
    }
    if (!options.preserveDateRange) {
      delete newHashParamsObj["_g"]; // _g holds time range and refresh interval
    }

    // Set build new hash params string and set it to previous URL
    const newHashParams = this.toHashParamsString(newHashParamsObj);

    // On single document page (#/doc/...), redirect to Discover page
    const hashPath = this.isDocPage() ? "#/" : this.hashPath;
    const newHash = `${hashPath}?${newHashParams}`;

    const url = new URL(this.rawUrl);
    url.hash = newHash;
    return url.toString();
  }
}
