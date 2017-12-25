
const createMemoryHistory = require('history').createMemoryHistory;
const ReactDOM = require('react-dom/server');
const minify = require('html-minifier').minify;
const matchRoutes = require('react-router-config').matchRoutes;
const { getBundles } = require('react-loadable/webpack');

const config = require('../build/config');
const readFile = require('./readFile');

const ssrModule = require(`${config.path.ssrDist}/ssr_modules.bundle`);
const stats = require(`${config.path.distPath}/react-loadable.json`);

const htmlPath = `${config.path.distPath}/index.html`;

module.exports = async (ctx, next) => {
    
    const matchRoute = matchRoutes(ssrModule.routers, ctx.originalUrl);
    
    if (!matchRoute.length) return;

    const store = ssrModule.createStore();
    
    if (matchRoute[0].route.init) {
        await matchRoute[0].route.init.default(store);
    }

    const modules = [];

    const renderReact = ssrModule.createApp(createMemoryHistory({
        initialEntries: [
            ctx.originalUrl
        ],
    }), store, true, modules);

    const renderReactStr = ReactDOM.renderToString(renderReact());

    const bundles = getBundles(stats, modules);

    const initStateStr = JSON.stringify(store.getState());

    const readHtmlStr = await readFile(htmlPath);

    const renderHtml = readHtmlStr
    .replace(/<!--initState-->/g, `<script> window.__INIT_STATE__ = ${initStateStr} </script>`)
    .replace(/<!--reactRenderContent-->/g, renderReactStr)
    .replace(/<\/body>/g, `
        ${bundles.map(bundle => `<script src="/${bundle.file}"></script>`).join('\n')}
        <script> window.main(); </script>
    `);
    
    const miniHtml = minify(renderHtml, {
        removeAttributeQuotes: true,
        collapseBooleanAttributes: true,
        collapseWhitespace: true,
    });

    ctx.set('Content-Type', 'text/html');
    ctx.type = 'charset=utf-8';
    ctx.body = miniHtml;
}