# AirSS

A light weight feed reader that runs in your browser, with no backend.

## Introduction

AirSS is an opinionated feed reader that is designed to aggregate and read blogs. It has very little functionality on the surface: You give it a bunch of feeds, it will feed you all the news, one item at a time. You cannot even jump ahead, let alone search or anything. The benefits are:

* No software to install, no service to sign up, no middle man, no cookie, no tracking, completely free with no string attached at all.
* It is tiny: 27KB transfer size for now, and that's html, style, scripts all put together, and I don't even bother with minifying or bundling.
* Supports [JSON feeds](https://www.jsonfeed.org/), [RSS2 feeds](https://validator.w3.org/feed/docs/rss2.html) and [Atom feeds](https://tools.ietf.org/html/rfc4287). Also automatically figures out feed url from HTML through [rel=alternate links](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types)
* You can also use the [roastidio.us](https://roastidio.us) commenting service (written and operated by me) to write your comment. The integration is just a simple link, there is no data sharing.

You need a ES6 compliant browser (sorry, IE fans). The main branch is auto-deployed here: [airss.roastidio.us](https://airss.roastidio.us) which is on [Vercel](https://vercel.com). All are welcome to use it. Since this is open source you can also clone it and host it somewhere else; it is all upto you.

I am too lazy to write documentation. There are only a few buttons, so just try it out. If you close the tab or browser or shut down the computer, you can pick it up right at where you left the next time you open it. The application will even shut down itself after a period of inactivity. For the curious minds, the application state is persistent on the local machine via [indexed db](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API); nothing go out to the internet. 

You can also use the this [bookmarklet](https://en.wikipedia.org/wiki/Bookmarklet): 

``` javascript
javascript:location.href='https://airss.roastidio.us/?url='+encodeURIComponent(window.location.href)
```

to subscribe any blog. Github does not allow a link with `javascript:` URL, so you need to bookmark any page, such as this page, then edit the property of your newly created bookmark, give it a name such as `subscribe in airss` and paste in the above bookmarklet string as it's location. Next time you came across an interesting blog, just click the bookmarklet and you are done. This trick may not work in a mobile brower though.

There is another trick: If your blog's index page links to [airss.roastidio.us](https://airss.roastidio.us) and your visitor click this link, the visitor will automatically subscribe to your blog. This magic happens in two steps: first, AirSS uses [referrer](https://en.wikipedia.org/wiki/HTTP_referer) to figure out where the visitor is comming from, then it uses the [rel=alternate links](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types) of that page to find out the feed. Neat, huh?

Comments or PRs are welcome.

## Caveat

The big caveat is that through no fault of its own, it only works with very few feeds, unless you do something (see later). The reason is [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS). For more info please see: [enable CORS](https://enable-cors.org/). The TL; DR is your browser will prevent AirSS from accessing other websites. I could use a proxy like all the other commersial on-line feed readers, but that kinds of defeats the purpose (simplicity, privacy, speed). All AirSS wants to do is to fetch and parse feeds, and the feeds:

* are usually static, so the cross site accesses pose no risk at all
* shall be considered public API entry points anyway

**If you are a blogger and operate your own web server, please see the the link: [enable CORS](https://enable-cors.org/) to find out how to enable CORS and reach out a broader audience.** Among the major hosting platforms out there, [Vercel](https://vercel.com) and [github pages](https://pages.github.com/) enable CORS by default for all static files, big kudos to them.

However, hope is not lost, even today. Via browser add-ons such as: [CORS everywhere](https://addons.mozilla.org/en-US/firefox/addon/cors-everywhere/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=search) and [CORS changer](https://chrome.google.com/webstore/detail/moesif-origin-cors-change/digfbfaphojjndkpccljibejjbppifbc?hl=en) Firefox and Chrome users can enjoy AirSS today on any feed. Please install one of the add-ons, whitelist `https://airss.roastidio.us` and everything shall be fine. If you are really paranoided, you are welcome to audit my source code to make sure there is nothing funny going on. With [state partitioning](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Privacy/State_Partitioning) imminent in Firefox, I believe even the bad guys will not be able to steal sensitive info via CORS.

The software shall be consider alpha quality right now. Use it  your own risk.
