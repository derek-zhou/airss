# Airss

Airss is a light weight RSS feed reader that runs entirely in your browser.

## Introduction

Airss is an opinionated feed reader that is designed to aggregate blogs and news in one place for you to read. It provides only the essential functionalities on the surface: You give it a bunch of feeds, it will feed you all the news, one item at a time. The benefits are:

* No software to install, no service to sign up, no middle man, no cookie, no tracking, completely free with no string attached.
* It is tiny: <100KB transfer size for now, and that's html, style, and scripts all put together. I don't even bother with minifying them.
* Supports [JSON feeds](https://www.jsonfeed.org/), [RSS2 feeds](https://validator.w3.org/feed/docs/rss2.html) and [Atom feeds](https://tools.ietf.org/html/rfc4287). Also automatically figures out feed url from typical web pages through [rel=alternate links](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types)
* You can __optionally__ use [roastidio.us](https://roastidio.us) to load feeds to bypass the [CORS](https://enable-cors.org/) restriction (more on this later).
* You can __optionally__ use the [roastidio.us](https://roastidio.us) commenting service (written and operated by me) to write your comment with a click of the button (🔥). The integration is just a simple link, there is no data sharing.

You need a ES2017 compliant browser (sorry, IE fans). The main branch is auto-deployed here: [airss.roastidio.us](https://airss.roastidio.us) which is on [Vercel](https://vercel.com). All are welcome to use it. Since the software is open sourced, you can also clone it and host it somewhere else; it is all upto you.

There are only a few buttons, so just try it out. If you close the tab or the browser, don't be afraid: your data is not lost and you can pick up right at where you left off the next time you open it. For the curious minds, the application state is persisted locally via [indexed db](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API); nothing goes out to the internet. 

To subscribe to a feed, you can click the (🍼) button then paste in a link. The link could be a feed (RSS2, Atom or JSON) link or a web page that the proper [rel=alternate links](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types). Airss will figure it out automatically. 

You can also use the this [bookmarklet](https://en.wikipedia.org/wiki/Bookmarklet): 

``` javascript
javascript:location.href='https://airss.roastidio.us/?url='+encodeURIComponent(window.location.href)
```

to subscribe to any blog. Github does not allow a link with `javascript:` URL, so you need to bookmark any page, such as this page, then edit the property of your newly created bookmark, give it a name such as `subscribe in airss` and paste in the above bookmarklet string as it's location. Next time you came across an interesting blog, just click the bookmarklet and you are done.

The above trick might not work in a mobile browser. On Android, you can install the excellent app [URL Forworder](https://play.google.com/store/apps/details?id=net.daverix.urlforward") by David Laurell to forward the link to Airss.

There is another trick: If your blog's index page links to Airss and your visitor click this link, the visitor will automatically subscribe to your blog. This magic happens in two steps: first, Airss uses [referrer](https://en.wikipedia.org/wiki/HTTP_referer) to figure out where the visitor is comming from, then it uses the [rel=alternate links](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types) of that page to find out the feed. Neat, huh?

One thing to keep in mind is you have to make sure the referer header is intact. In Firefox 87+ the default of referrer policy is very strict, it will strip off path and query string when crossing origins. So you would need to add the proper referrerpolicy attribute in the link:

``` html
<a href="https://airss.roastidio.us/?subscribe-referrer" referrerpolicy="no-referrer-when-downgrade">Follow me with Airss!</a>
```

Comments or PRs are welcome.

## Caveat

The biggest caveat is that through no fault of its own, it only works with very few feeds, unless you do something extra (see later). The reason is [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS). For more info please see: [enable CORS](https://enable-cors.org/). The TL; DR is your browser will prevent Airss from accessing other websites. Airss has to fetch and parse feeds, and:

* The feeds are usually static, so the cross site accesses pose no risk at all
* They shall be considered public API entry points anyway

So it is completely safe. **If you are a blogger and operate your own web server, please see the the link: [enable CORS](https://enable-cors.org/) to find out how to enable CORS and reach out to a broader audience.** Among the major hosting platforms out there, [Vercel](https://vercel.com) and [github pages](https://pages.github.com/) enable unrestricted CORS by default for all static files, big kudos to them.

## Cures for CORS

Hope is not lost, even today. If you use a user script manager such as [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/), [Violentmonkey](https://violentmonkey.github.io/), or [Tampermonkey](https://www.tampermonkey.net/), you can [install this user script](https://greasyfork.org/en/scripts/433329-airss-cors-bypass). Installing it will immediately make the Airss instance on airss.roastidio.us be able to access all feed URLs, including ones that are cross-origin or http only. (Access for other instances can be added by editing the script.)

CORS restriction can also be turned off by browser add-ons such as: [CORS everywhere](https://addons.mozilla.org/en-US/firefox/addon/cors-everywhere/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=search) and [CORS changer](https://chrome.google.com/webstore/detail/moesif-origin-cors-change/digfbfaphojjndkpccljibejjbppifbc?hl=en), on Firefox and Chrome. Please install one of the add-ons, whitelist `https://airss.roastidio.us` and everything shall be fine. Safafi users can turn on the develop menu and disable the cross-origin restrictions from the menu. Mobile users please see the next section. If you are really paranoided, you are welcome to audit my source code to make sure there is nothing funny going on.

## Proxy

I provide a proxy service through [Roastidio.us](https://roastidio.us) to anyone, without needing to login, so the CORS restriction can be circumvented, no user scripts or browser add-ons are needed. Just check the box `Load feeds with roastidio.us` (default checked now) in the config page and all should be good; no browser plugin or developer menu is required.

* Loading feeds should be faster because Roastidio.us will load feeds in the background and cache the results
* You can also save your collection of feeds to the backend anonymously, and restore it from another device using a short and time limited secret 
* The feed owners will not know your IP or browser fingerprint so you remain completely anonymous
* If I turn evil I could sabotage the feed content, but your privacy will not be harmed

[Roastidio.us](https://roastidio.us) is a free commenting service open to everyone, and is written and operated by the me. To actually post a comment you do need to login (free registration).

By the way, I am accumulating high quality feeds to build a search engine specifically design for feeds. Any feed you load via [roastidio.us](https://roastidio.us) will be indexed. When and who load the feeds are not recorded to respect your privacy. You are welcomed to try the search engine right now: [Roastidio.us Search](https://roastidio.us/search) (free registration required)

## Disclaimer

The software is tailored to my needs and may never become a full-featured Feed reader. I use it everyday, your mileage may vary. 
