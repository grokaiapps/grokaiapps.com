Installed on grokaiapps.com under /exhibits/aether/ with relative paths.

Aether — Siteground install
===========================

This folder is a static site. No Node, PHP, or database.

It will NOT work as yourdomain.com/subfolder unless that folder is a
subdomain document root.

Install
-------
1. Unzip Aether.zip on your computer.
2. In Siteground Site Tools, create a subdomain such as app.mydomain.com.
3. Set the subdomain document root to public_html/app (or the folder
   Siteground assigns to that subdomain).
4. Upload the CONTENTS of the unzipped folder into that document root.
   Upload index.html, assets, favicon.svg, .htaccess, and the rest —
   not an extra nested folder named Aether.
5. Visit https://app.mydomain.com

If you upload the zip itself, unzip it on the server first, then make
sure index.html sits at the document root.

Publish on Grok is not this zip. This zip is the Siteground package.
