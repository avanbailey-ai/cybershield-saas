# Google Search Console Setup

Canonical domain: **https://cybershieldcloud.com**

## 1. Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: **URL prefix** `https://cybershieldcloud.com`
3. Verify ownership (choose one):
   - **DNS TXT** record on `cybershieldcloud.com` (recommended)
   - **HTML file** upload to `public/` (if using file method)
   - **Google Analytics** (if GA4 already installed on domain)
4. Submit sitemap: `https://cybershieldcloud.com/sitemap.xml`
5. Validate `https://cybershieldcloud.com/robots.txt`
6. Use **URL Inspection** on:
   - `/`
   - `/pricing`
   - `/scan`
   - `/features/website-security-monitoring`

## 2. Google Analytics

1. Create GA4 property for `cybershieldcloud.com`
2. Add measurement ID to environment / analytics provider if not already wired
3. Link GA4 property to Search Console (Admin → Product links)

## 3. Bing Webmaster Tools

1. [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. Add site `https://cybershieldcloud.com`
3. Import from Google Search Console (fastest) or verify via DNS
4. Submit sitemap: `https://cybershieldcloud.com/sitemap.xml`

## 4. Google Business Profile

For local discoverability (even remote-first):

- Business name: **CyberShield Cloud**
- Category: Software company / Security service (as appropriate)
- Website: `https://cybershieldcloud.com`
- Keep NAP consistent with `/contact` and footer

## 5. Structured data validation

Test with [Google Rich Results Test](https://search.google.com/test/rich-results):

- Homepage (Organization, WebSite, SoftwareApplication, FAQ)
- `/features/ssl-monitoring` (WebPage, Breadcrumb)

## 6. Post-launch checks

- [ ] No accidental `noindex` on public pages
- [ ] Canonical URLs use `resolveSiteUrl()` / production domain
- [ ] Core Web Vitals reviewed in Search Console after 28 days
- [ ] Monitor Coverage report for excluded/blocked URLs
