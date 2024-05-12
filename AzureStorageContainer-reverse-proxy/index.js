const express = require("express");
const proxy = require("http-proxy").createProxy();

require("dotenv").config();

const app = express();
const PORT = 8000;
const BASE_PATH = process.env.BASE_PATH;


app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split(".")[0];

    const resolvesTo = `${BASE_PATH}/${subdomain}`
    console.log(`Proxying to: ${resolvesTo}${req.url}`);
    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true })

});




proxy.on('proxyReq', function (proxyReq, req, res) {
    const url = req.url
    if (url === "/") {
        proxyReq.path += "index.html"
    }

    return proxyReq
});
app.listen(PORT, () => {
    console.log(`http proxy started on PORT: ${PORT}`);
});

