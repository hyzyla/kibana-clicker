# Kibana Clicker — browser extension for Kibana

The extension creates links for quick filtering logs in Kibana.

![screenshot of extension](media/window-screenshoot.png)

[Kibana demo site](https://demo.elastic.co/app/discover#/)
### Build locally

1. run `npm install` to install all required dependencies
2. run `npm run build` to build extension

The build step will create the `distribution` folder, this folder will contain
the generated extension.

### Run the extension

Using [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)
is recommended for automatic reloading and running in a dedicated browser
instance. Alternatively you can load the extension manually (see below).

1. run `npm run watch` to watch for file changes and build continuously
2. run `npm install --global web-ext` (only for the first time)
3. in another terminal, run `web-ext run` for Firefox
   or `web-ext run -t chromium`


### Other
Built using
[fregante/browser-extension-template](https://github.com/fregante/browser-extension-template/generate)
template
