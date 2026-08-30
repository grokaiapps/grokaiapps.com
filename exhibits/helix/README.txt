Installed on grokaiapps.com under /exhibits/helix/ with relative paths.

HELIX STUDIO
------------

A playable analog-style synth (Helix) and light field (Lumen).
This zip is a finished website. You do not need Node, PHP, or a database.


INSTALL ON SITEGROUND
---------------------

Best option: give Helix its own subdomain (helix.yourdomain.com)

1. Unzip this file on your computer. You should see index.html, an assets
   folder, favicon.svg, and a few other files.

2. In Siteground go to Site Tools → Domain → Subdomains.
   Create a subdomain, for example: helix
   Set the document root to public_html/helix (Siteground will offer this).

3. Open Site Tools → Site → File Manager.
   Go into public_html/helix.

4. Upload EVERY file from the unzipped folder into that directory.
   Upload the contents (index.html, assets, etc.), not a second nested folder.

5. Visit https://helix.yourdomain.com
   You should see the Helix loading screen, then Enable audio.


Install at the main domain instead
----------------------------------
If this should BE your homepage, upload those same files into public_html
(the root of your site). That will replace whatever is currently there.


Do not install in a subfolder of an existing site
-------------------------------------------------
Files are loaded from the site root (/assets/..., /favicon.svg).
A folder like yourdomain.com/helix/ will not work unless that folder is
the document root of a subdomain, as above.


HTTPS
-----
Turn on HTTPS in Siteground (Site Tools → Security → SSL).
The app needs a secure page for audio in some browsers.


THAT'S IT
---------
No installer, no npm, no database. If the loading screen appears, it worked.
