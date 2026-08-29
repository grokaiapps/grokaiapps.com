Stylophone — Siteground install
================================

Installed on grokaiapps.com under /exhibits/stylophone/ with relative
asset paths (./assets, ./favicon.svg). A subdomain is not required.

This is a static website. No Node, PHP, or database is required.

Where it will work
------------------
Upload these files as the DOCUMENT ROOT of a subdomain, for example:

  app.mydomain.com  →  public_html/app

The zip contents must sit DIRECTLY in that document root
(index.html next to assets/, not inside an extra nested folder).

It will NOT work as yourdomain.com/subfolder unless that folder is
set as a subdomain (or addon domain) document root.

Steps
-----
1. In Siteground Site Tools, create a subdomain such as app.mydomain.com.
   Set its document root to something like public_html/app (empty folder).

2. Unzip Stylophone.zip on your computer.

3. Upload the FOLDER CONTENTS (index.html, assets/, favicon.svg,
   .htaccess, README.txt) into that document root.
   Do not upload a wrapping folder named Stylophone.

4. Visit https://app.mydomain.com

5. If you see a blank page, confirm index.html is in the document root
   (not public_html/app/Stylophone/index.html).

Publish in the Grok preview is not this zip. This zip is the copy
you install on Siteground yourself.
