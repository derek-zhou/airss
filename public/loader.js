/*
 * networking loading module
 */

import * as Model from './airss_model.js';
import * as Sanitizer from './sanitizer.js';

export {subscribe, load, reloadUrl, saveFeeds, restoreFeeds};

// truncate to at most 25 items per loading
const TruncateItems = parseInt(localStorage.getItem("TRUNCATE_ITEMS_PER_FEED")) || 25;
// kept in days
const MaxKeptPeriod = parseInt(localStorage.getItem("MAX_KEPT_PERIOD")) || 180;
// whether to load with bouncer
const BounceLoad = localStorage.getItem("BOUNCE_LOAD") != "false";
const BouncerRoot = "https://roastidio.us"
const Bouncer = BouncerRoot + "/bounce?url=";
const FullText = BouncerRoot + "/fulltext?url=";
const Buffer = BouncerRoot + "/buffer";
const Stash = BouncerRoot + "/stash";
const FeedType = {
    json: 1,
    xml: 2
}

// common feed file name that should cover all major SSGs.
// I left out the names without extension because there is no way to determine type
const JSONFeedNameSet = new Set(['feed.json', 'index.json']);
const XMLFeedNameSet = new Set(['rss.xml', 'rss2.xml', 'atom.xml',
				'index.xml', 'index.rss', 'index.rss2', 'index.atom',
				'feed.xml', 'feed.rss', 'feed.rss2', 'feed.atom']);

/*
 * callback side state and entry points
 */

let enabled = true;

async function cb_subscribe(prev, url) {
    await prev;
    if (!enabled)
	return;
    try {
	Model.loadingStart();
	let feed = await sanitize(url);
	if (!feed)
	    Model.warn("Unauthorized. Please login to <a href=\""
		       + BouncerRoot + "\">roastidio.us</a> then reload Airss");
	Model.loadingDone();
    } catch (e) {
	if (typeof e === 'string' || (e instanceof TypeError)) {
	    Model.error("The feed '" + url + "' is not valid");
	    console.error("The feed '" + url + "' is not valid: " + e);
	    Model.loadingDone();
	    return;
 	} else {
	    Model.loadingDone();
	    console.log("error");
	    throw e;
	}
    }
}

async function cb_load(prev, obj) {
    await prev;
    if (!enabled)
	return;
    try {
	Model.loadingStart();
	let ret = await loadFeed(obj.feed, obj.items);
	if (ret)
	    Model.updateFeed(ret.updated, ret.items);
	else
	    Model.warn("Unauthorized. Please login to <a href=\""
		       + BouncerRoot + "\">roastidio.us</a> then reload Airss");
	Model.loadingDone();
    } catch (e) {
	if (typeof e === 'string' || (e instanceof TypeError)) {
	    obj.feed.error = e.toString();
	    Model.updateFeed(obj.feed, []);
	    Model.loadingDone();
	} else {
	    Model.loadingDone();
	    throw e;
	}
    }
}

async function cb_reloadUrl(prev, url, id) {
    await prev;
    if (!enabled)
	return null;
    try {
	Model.loadingStart();
	let response = await bufferReload(url);
	if (response.status != 200) {
	    Model.warn("Reloading of url: " + url + " failed with status: " + response.status);
	    Model.loadingDone();
	    return null;
	}
	let data = await response.text();
	let text = BounceLoad ? data : Sanitizer.sanitizeHtml(data);
	Model.updateItemText(text, id);
	Model.loadingDone();
    } catch (e) {
	Model.error("Reloading of url: " + url + " failed");
	Model.loadingDone();
    }
}

async function cb_saveFeeds(prev) {
    await prev;
    if (!enabled || !BounceLoad)
	return;
    let urls = await Model.allFeedUrls();
    if (urls.length == 0)
	return;
    try {
	Model.loadingStart();
	let response = await fetch(Stash, {
	    method: "POST",
	    headers: {
		'Accept': 'application/json',
		'Content-Type': 'application/octet-stream'
	    },
	    body: JSON.stringify({feeds: urls}),
	    mode: "cors"
	});
	if (response.status != 200) {
	    Model.warn("Saving feeds failed with status: " + response.status);
	    Model.loadingDone();
	    return;
	}
	let data = await response.json();
	Model.postHandle(data.handle);
	Model.loadingDone();
    } catch (e) {
	Model.error("Saving feeds failed");
	Model.loadingDone();
    }
}

async function cb_restoreFeeds(prev, handle) {
    await prev;
    if (!enabled || !BounceLoad)
	return;
    try {
	Model.loadingStart();
	let response = await fetch(Stash + "/" + handle, {mode: "cors"});
	if (response.status != 200) {
	    Model.warn("Restoring feeds failed with status: " + response.status);
	    Model.loadingDone();
	    return;
	}
	let data = await response.json();
	for (let url of data.feeds.values()) {
	    let feed = new Object();
	    feed.feedUrl = url;
	    feed.lastLoadTime = 0;
	    Model.addFeed(feed);
	}
	Model.info("Successfully restoring feeds.");
	Model.loadingDone();
    } catch (e) {
	Model.error("Restoring feeds failed");
	Model.loadingDone();
    }
}

function myFetch(url) {
    if (BounceLoad && !url.startsWith(BouncerRoot)) {
	return fetch(Bouncer + encodeURIComponent(url), {
	    mode: "cors"
	});
    } else {
	return fetch(url);
    }
}

function bufferFetch(url, except) {
    if (BounceLoad) {
	return fetch(Buffer, {
	    method: "POST",
	    headers: {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	    },
	    body: JSON.stringify({url: url, except: except}),
	    mode: "cors"
	});
    } else {
	return fetch(url);
    }
}

function bufferReload(url) {
    if (BounceLoad) {
	return fetch(FullText + encodeURIComponent(url), {
	    mode: "cors"
	});
    } else {
	return fetch(url);
    }
}

async function loadFeed(feed, except) {
    let response = await bufferFetch(feed.feedUrl, except);
    let updated = {...feed};
    if (BounceLoad && response.status == 401) {
	enabled = false;
	return false;
    }
    else if (response.status != 200)
	throw "fetching failed in loadFeed";

    if (!BounceLoad && response.redirected) {
	// trust redirected url for direct load
	updated.feedUrl = response.url;
    }
    // buffer load is always in JSON
    if (BounceLoad) {
	let data = await response.json();
	if (data.error)
	    throw data.error;
	updated = parseJSONFeed(updated, data);
	// buffer load is trust worthy for feed_url
	updated.feedUrl = data.feed_url;
	let items = processItems(data.items, updated, parseJSONItem, false);
	return {updated: updated, items: items};
    }
    switch (feed.type) {
    case FeedType.json:
	let data = await response.json();
	updated = parseJSONFeed(updated, data);
	let items = processItems(data.items, updated, parseJSONItem, true);
	return {updated: updated, items: items};
    default:
	let parser = new DOMParser();
	let text = await response.text();
	let doc = parser.parseFromString(text, "text/xml");
	if (doc.documentElement.tagName == 'parsererror')
	    throw doc.documentElement.textContent;
	let rss2Feed = doc.querySelector("channel");
	if (rss2Feed) {
	    updated = parseRSS2Feed(updated, rss2Feed);
	    let items = processItems(rss2Feed.querySelectorAll("item"), updated, parseRSS2Item, true);
	    return {updated: updated, items: items};
	}
	let atomFeed = doc.querySelector("feed");
	if (atomFeed) {
	    updated = parseATOMFeed(updated, atomFeed);
	    let items = processItems(atomFeed.querySelectorAll("entry"), updated, parseATOMItem, true);
	    return {updated: updated, items: items};
	}
    }
    throw "internal error in loadFeed";
}

function mimeToType(mime) {
    switch (mime) {
    case "application/json":
    case "application/feed+json":
	return FeedType.json;
    case "application/atom+xml":
    case "application/rss+xml":
    case "application/x-rss+xml":
    case "application/xml":
    case "text/xml":
	return FeedType.xml;
    default:
	return null;
    }
}

function strictMimeToType(mime) {
    switch (mime) {
    case "application/feed+json":
	return FeedType.json;
    case "application/atom+xml":
    case "application/rss+xml":
	return FeedType.xml;
    default:
	return null;
    }
}

function feedTypeFromName(path) {
    let parts = path.split("/");
    let name = parts[parts.length - 1];
    if (JSONFeedNameSet.has(name))
	return FeedType.json;
    if (XMLFeedNameSet.has(name))
	return FeedType.xml;
    return null;
}

async function loadInitFeed(response, feed) {
    switch (feed.type) {
    case FeedType.json:
	let data = await response.json();
	let updated = parseJSONFeed(feed, data);
	let items = processItems(data.items, updated, parseJSONItem, true);
	Model.updateFeed(updated, items);
	return updated;
    case FeedType.xml:
	let parser = new DOMParser();
	let text = await response.text();
	let doc = parser.parseFromString(text, "text/xml");
	if (doc.documentElement.tagName == 'parsererror')
	    throw doc.documentElement.textContent;
	let rss2Feed = doc.querySelector("channel");
	if (rss2Feed) {
	    let updated = parseRSS2Feed(feed, rss2Feed);
	    let items = processItems(rss2Feed.querySelectorAll("item"), updated, parseRSS2Item, true)
	    Model.updateFeed(updated, items);
	    return updated;
	}
	let atomFeed = doc.querySelector("feed");
	if (atomFeed) {
	    let updated = parseATOMFeed(feed, atomFeed);
	    let items = processItems(atomFeed.querySelectorAll("entry"), updated, parseATOMItem, true)
	    Model.updateFeed(updated, items);
	    return updated;
	}
    }
    throw "Illegal feed content";
}

// return a feed object if url is ok, or throw
async function sanitize(url) {
    // first we need to make sure it is a valid url. If not,
    // the next line will throw
    let urlObject = new URL(url);
    if (urlObject.protocol != 'http:' && urlObject.protocol != 'https:')
	throw "Only http(s) is supported";
    let feed = new Object();
    let response = await myFetch(url);
    if (BounceLoad && response.status == 401) {
	enabled = false;
	return false;
    } else if (response.status != 200)
	throw "fetching failed in sanitize";

    if (response.redirected) {
	console.info(url + " redirected to: " + response.url);
	if (BounceLoad && !url.startsWith(BouncerRoot)) {
	    let urlObject = new URL(response.url);
	    let search = urlObject.searchParams;
	    let feedUrl = search.get('url');
	    url = feedUrl;
	} else {
	    url = response.url;
	}
    }
    let mime = response.headers.get('Content-Type');
    let parts = mime.split(/\s*;\s*/);
    mime = parts[0];
    feed.feedUrl = url;
    feed.lastLoadTime = 0;
    feed.lastFetchTime = 0;
    feed.type = mimeToType(mime);
    if (feed.type != null)
	return await loadInitFeed(response, feed);

    switch (mime) {
    case "text/html":
    case "application/xhtml+xml":
	const parser = new DOMParser();
	const html = await response.text();
	const doc = parser.parseFromString(html, "text/html");
	const links = doc.head.querySelectorAll("link[rel=alternate]");
	for (let link of links.values()) {
	    let href = link.getAttribute("href");
	    let type = strictMimeToType(link.getAttribute("type"));
	    if (!href)
		continue;
	    if (!type)
		continue;
	    feed.type = type;
	    let mergedUrl = new URL(href, url);
	    feed.feedUrl = mergedUrl.toString();
	    let response = await myFetch(feed.feedUrl);
	    if (BounceLoad && response.status == 401) {
		enabled = false;
		return false;
	    }
	    else if (response.status != 200) {
		throw "fetching failed in sanitize";
	    }
	    return await loadInitFeed(response, feed);
	}

	// try all anchors
	console.info("No link auto-discovery. trying anchors by name");
	const anchors = doc.body.querySelectorAll("a");
	for (let anchor of anchors.values()) {
	    let href = anchor.getAttribute("href");
	    if (!href)
		continue;
	    feed.type = feedTypeFromName(href);
	    if (!feed.type)
		continue;
	    let mergedUrl = new URL(href, url);
	    feed.feedUrl = mergedUrl.toString();
	    let response = await myFetch(feed.feedUrl);
	    if (BounceLoad && response.status == 401) {
		enabled = false;
		return false;
	    }
	    else if (response.status != 200) {
		throw "fetching failed in sanitize";
	    }
	    return await loadInitFeed(response, feed);
	}
	throw "No feed discovered";
    }
    throw "Unrecognized mime";
}

function processItems(rawItems, feed, parseFunc, sanitize) {
    let now = new Date();
    let items = [];
    let counter = 0;

    if (rawItems) {
	for (let item of rawItems.values()) {
	    // never look pass more than TruncateItems from the top. Some feeds are long
	    if (counter >= TruncateItems)
		break;
	    else
		counter ++;
	    item = parseFunc(item);
	    // some items are invalid
	    if (!item)
		continue;
	    else if (item.datePublished > now)
		continue;
	    else if (now - item.datePublished <= MaxKeptPeriod*24*3600*1000) {
		// duplicate info for simple access
		item.feedTitle = feed.title;
		item.feedId = feed.id;
		item.title = Sanitizer.sanitizeText(item.title);
		item.contentHtml = sanitize ? Sanitizer.sanitizeHtml(item.contentHtml) : item.contentHtml;
		items = [...items, item];
	    }
	}
    }
    return items;
}

function parseJSONFeed(feed, json) {
    let newFeed = {...feed};
    newFeed.title = json.title;
    if (json.home_page_url)
	newFeed.homePageUrl = json.home_page_url;
    return newFeed;
}

function parseRSS2Feed(feed, channel) {
    let newFeed = {...feed};
    const title = getXMLTextContent(channel, "title");
    const link = getXMLTextContent(channel, "link");
    newFeed.title = title;
    if (link)
	newFeed.homePageUrl = link;
    return newFeed;
}

function parseATOMFeed(feed, channel) {
    let newFeed = {...feed};
    const title = getXMLTextContent(channel, "title");
    const link = getXMLTextAttribute(channel, "link[rel=alternate]", "href");
    newFeed.title = title;
    if (link)
	newFeed.homePageUrl = link;
    return newFeed;
}

function getXMLTextContent(elem, selector) {
    const sub = elem.querySelector(selector);
    if (sub)
	return sub.textContent.trim();
    else
	return null;
}

function getXMLTextAttribute(elem, selector, attr) {
    const sub = elem.querySelector(selector);
    if (sub)
	return sub.getAttribute(attr);
    else
	return null;
}

function enforceURL(url) {
    try {
	let absUrl = new URL(url);
	return absUrl.toString();
    } catch(e) {
	return null;
    }
}

function parseJSONItem(json) {
    let item = new Object();
    item.datePublished = new Date(json.date_published);
    if (json.content_html !== undefined)
	item.contentHtml = json.content_html;
    else if (json.content_text !== undefined)
	item.contentHtml = '<p>' + json.content_text + '</p>';
    else
	item.contentHtml = "";
    item.url = enforceURL(json.url);
    if (!item.url || !item.datePublished)
	return null;
    item.imageUrl = json.image;
    item.title = json.title;
    if (json.tags)
	item.tags = json.tags;
    else
	item.tags = [];
    return item;
}

function parseRSS2Item(elem) {
    let item = new Object();
    const pubDate = getXMLTextContent(elem, "pubDate");
    const description = getXMLTextContent(elem, "description");
    // there is no way to select XML namespace.
    // Hopefully there is no other encoded than content:encoded
    const content = getXMLTextContent(elem, "*|encoded");
    const link = getXMLTextContent(elem, "link");
    const title = getXMLTextContent(elem, "title");
    const enclosure = getXMLTextAttribute(elem, "enclosure", "url");
    const enclosure_type = getXMLTextAttribute(elem, "enclosure", "type");
    const categories = elem.querySelectorAll("category");
    let tags = [];
    for (let category of categories.values()) {
	tags = [...tags, category.textContent];
    }
    if (pubDate)
	item.datePublished = new Date(pubDate);
    if (content)
	item.contentHtml = content;
    else if (description)
	item.contentHtml = description;
    else
	item.contentHtml = "";
    if (enclosure_type) {
	const tokens = enclosure_type.split('/');
	if (tokens[0] == 'image')
	    item.imageUrl = enclosure;
    }
    item.url = enforceURL(link);
    if (!item.url || !item.datePublished)
	return null;
    if (title)
	item.title = title;
    item.tags = tags;
    return item;
}

function parseATOMItem(elem) {
    let item = new Object();
    const published = getXMLTextContent(elem, "published");
    const updated = getXMLTextContent(elem, "updated");
    const content = getXMLTextContent(elem, "content");
    const summary = getXMLTextContent(elem, "summary");
    const link = getXMLTextAttribute(elem, "link", "href");
    const alternate = getXMLTextAttribute(elem, "link[rel=alternate]", "href");
    const enclosure = getXMLTextAttribute(elem, "link[rel=enclosure]", "href");
    const enclosure_type = getXMLTextAttribute(elem, "link[rel=enclosure]", "type");
    const title = getXMLTextContent(elem, "title");
    const categories = elem.querySelectorAll("category");
    let tags = [];
    for (let category of categories.values()) {
	tags = [...tags, category.getAttribute("term")];
    }
    if (published)
	item.datePublished = new Date(published);
    else if (updated)
	item.datePublished = new Date(updated);
    if (content)
	item.contentHtml = content;
    else if (summary)
	item.contentHtml = '<p>' + summary + '</p>';
    else
	item.contentHtml = "";
    if (enclosure_type) {
	const tokens = enclosure_type.split('/');
	if (tokens[0] == 'image')
	    item.imageUrl = enclosure;
    }
    if (alternate)
	item.url = enforceURL(alternate);
    else
	item.url = enforceURL(link);
    if (!item.url || !item.datePublished)
	return null;
    if (title)
	item.title = title;
    item.tags = tags;
    return item;
}

/*
 * client side state
 */

let state = null;

function subscribe(url) {
    state = cb_subscribe(state, url);
}

function load(obj) {
    state = cb_load(state, obj);
}

function reloadUrl(url, id) {
    state = cb_reloadUrl(state, url, id);
}

function saveFeeds() {
    state = cb_saveFeeds(state);
}

function restoreFeeds(handle) {
    state = cb_restoreFeeds(state, handle);
}
