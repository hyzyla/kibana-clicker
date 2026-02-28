import rison from "rison";

type RisonValue = string | number | boolean | null | RisonValue[] | { [key: string]: RisonValue };

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

    // Hash param is not URL encoded and it contans path and params with rison encoded values
    const [hashPath, hashParams] = this.hash.split("?", 2);
    this.hashPath = hashPath;
    this.hashParams = hashParams;
    this.hashParamsObj = this.parseHashParams(this.hashParams);
    console.log("hashParamsObj", url, this.hashParamsObj);
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

  private setHashParamsQuery(
    params: Record<string, RisonValue>,
    options: {
      name: string;
      value: string;
    },
  ): Record<string, RisonValue> {
    const a = ((params["_a"] as Record<string, RisonValue>) ??= {});
    const aQuery = ((a["query"] as Record<string, RisonValue>) ??= {});
    aQuery["query"] = `${options.name}:"${options.value}"`;

    const q = ((params["_q"] as Record<string, RisonValue>) ??= {});
    const qQuery = ((q["query"] as Record<string, RisonValue>) ??= {});
    qQuery["query"] = `${options.name}:"${options.value}"`;
    return params;
  }

  toHashParamsString(hashParams: Record<string, RisonValue>): string {
    return Object.entries(hashParams)
      .map(([key, value]) => {
        return `${key}=${rison.encode(value)}`;
      })
      .join("&");
  }

  /**
   * Returns new URL with given query
   *
   * This method doesn't mutate object state
   */
  withQuery(options: {
    name: string;
    value: string;
    preserveFilters?: boolean;
    preserveDateRange?: boolean;
    preserveColumns?: boolean;
  }): string {
    // To avoid mutation of previous hash params clone it
    const prevHashParams = structuredClone(this.hashParamsObj);

    // Set new query
    const newHashParamsObj = this.setHashParamsQuery(prevHashParams, {
      name: options.name,
      value: options.value,
    });

    // Conditionally strip hash params based on settings
    if (!options.preserveFilters) {
      const a = newHashParamsObj["_a"] as Record<string, RisonValue> | undefined;
      if (a) delete a["filters"];
    }
    if (!options.preserveColumns) {
      const a = newHashParamsObj["_a"] as Record<string, RisonValue> | undefined;
      if (a) delete a["columns"];
    }
    if (!options.preserveDateRange) {
      delete newHashParamsObj["_g"];
    }

    // Set build new hash params string and set it to previous URL
    const newHashParams = this.toHashParamsString(newHashParamsObj);

    // On single document page (#/doc/...), redirect to Discover page
    const hashPath = this.hashPath.startsWith("#/doc/") ? "#/" : this.hashPath;
    const newHash = `${hashPath}?${newHashParams}`;

    const url = new URL(this.rawUrl);
    url.hash = newHash;
    return url.toString();
  }
}
