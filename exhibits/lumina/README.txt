Installed on grokaiapps.com under /exhibits/lumina/ with relative paths.

Lumina — Siteground install

This is a static website. No Node, PHP, or database is required.

1. Unzip Lumina.zip on your computer. You should see index.html in that folder
   (not inside another nested folder).

2. In Siteground, create a subdomain such as app.mydomain.com.
   Set its document root to public_html/app (or the folder Siteground assigns
   to that subdomain).

3. Upload the CONTENTS of the unzipped folder into that document root:
   index.html, .htaccess, assets, favicon.svg, and the rest.
   Do not upload a single extra wrapper folder. After upload, visiting the
   subdomain should load index.html at the root.

This will NOT work as yourdomain.com/subfolder unless that folder is the
subdomain document root. Hashed JS/CSS paths are absolute from the site root
(/assets/...), so a regular subdirectory on the main domain will break.

Apache .htaccess is included:
  - DirectoryIndex index.html
  - SPA rewrite of unknown paths to index.html
  - Long cache for hashed assets
