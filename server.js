const express = require("express");
const path = require("path");

const app = express();

const port = 8080;


/* =========================================================
   STATIC FILES
   ========================================================= */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =========================================================
   ANA SAYFA
   ========================================================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


/* =========================================================
   SUNUCUYU BAŞLAT
   ========================================================= */

app.listen(port, () => {

    console.log(
        `Sunucu http://localhost:${port} adresinde çalışıyor`
    );

});
