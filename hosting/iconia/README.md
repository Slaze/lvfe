# Iconia site copies (terms)

Canonical live Terms: `https://iconiaglobal.com/pages/terms-and-conditions`

That URL is a Yii2 CMS page (`page.slug = terms-and-conditions`). Body HTML is stored in MySQL and rendered with `html_purify`. Do **not** replace the URL with a parallel `/terms` file unless the CMS row is gone.

Markdown source of record in this repo: `docs/ICONIA_TERMS.md`  
HTML body used for the CMS `content` column: `hosting/iconia/terms-content.html`

Deploy: update the `page` row on the Iconia host (operator FTP + local MySQL). Privacy footer links stay on `/pages/privacy-policy`.
