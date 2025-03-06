import * as Controller from "./airss_controller.js";
import {Assets} from "./assets.js";
import {replay, hook, elem, text, fill, attr, cl, div, shadow_div} from "./domfun.js";

export const Subscribe = {
    feedUrl: "feedUrl"
};

export const Trash = {
    shouldUnsubscribe: "shouldUnsubscribe"
};

export const Config = {
    waterMark: "waterMark",
    minReloadWait: "minReloadWait",
    maxKeptPeriod: "maxKeptPeriod",
    maxItemsPerFeed: "maxItemsPerFeed",
    truncateItemsPerFeed: "truncateItemsPerFeed",
    bounceLoad: "bounceLoad",
    restoreHandle: "restoreHandle",
    clearDatabase: "clearDatabase"
};

/*
 * The view layer of AirSS.
 */

function fixup_links(container, url) {
    // fix up all img's src
    for (const img of container.querySelectorAll("img").values()) {
	const href = img.getAttribute("src");
	try {
	    const absUrl = new URL(href, url);
	    img.setAttribute("src", absUrl.toString());
	} catch (e) {
	    console.warn(href + "is not a valid link");
	}
    }
    // fixup all a's href
    for (const link of container.querySelectorAll("a").values()) {
	const href = link.getAttribute("href");
	try {
	    const absUrl = new URL(href, url);
	    link.setAttribute("href", absUrl.toString());
	    link.setAttribute("target", "_blank");
	} catch (e) {
	    console.warn(href + "is not a valid link");
	}
    }
}

function stopPropagation(e) {
    e.stopImmediatePropagation();
}

function autoAdjustHeight(e) {
    const textarea = e.currentTarget;
    const offset = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = textarea.scrollHeight + offset + 'px';
}

function dummy(item) {
    if (!item)
	return true;
    const tags = item.tags;
    return tags.length == 1 && tags[0] == "_error";
}

function leftDisabled(state) {
    return state.cursor <= 0 || state.screen != Controller.Screens.browse;
}

function rightDisabled(state) {
    return state.cursor >= state.length - 1 || state.screen != Controller.Screens.browse;
}

function alertClass(type) {
    switch (type) {
    case "error":
	return "alert-danger";
    case "warning":
	return "alert-warning";
    default:
	return "alert-info";
    }
}

// render everything from scratch
export function render(state) {
    replay(document.body, body(state));
}

function body(state) {
    return [
	div(progressBar(state)),
	div(cl("viewport"),
	    hook("touchstart", Controller.touchStartEvent),
	    hook("touchmove", Controller.touchMoveEvent),
	    div(alert(state)),
	    div(application(state)),
	    div(article(state)),
	    div(footer(state)))
    ];
}

function progressBar(state) {
    return state.loading ? cl("progress-bar") : [];
}

function footer(state) {
    return [
	cl("footer"),
	div(cl("left-half"),
	    elem("a", [
		attr({
		    href: "https://roastidio.us/roast",
		    referrerpolicy: "no-referrer-when-downgrade"
		}),
		text("Roast me at Roastidious")
	    ])),
	div(cl("right-half"),
	    elem("a", [
		attr({
		    href: "https://github.com/derek-zhou/airss",
		    referrerpolicy: "no-referrer-when-downgrade"
		}),
		text("Fork me on GitHub")
	    ]))
    ];
}

function application(state) {
    return [
	navbar(state),
	dialog(state)
    ];
}

function navbar(state) {
    return [
	div(cl("navbar"),
	    div(elem("a", [
		    attr({href: "index.html"}),
		    elem("img", attr({src: Assets.logoImage, class: "logo"})),
		]),
		elem("span", [
		    cl("info"),
		    text(`${state.cursor+1}/${state.length}`)
		])),
	    div(cl("toolbar"),
		elem("button", [
		    cl("button"),
		    hook("click", Controller.clickConfigEvent),
		    text("🔧")
		]),
		elem("button", [
		    cl("button"),
		    hook("click", Controller.clickSubscribeEvent),
		    text("🍼")
		]),
		elem("button", [
		    cl("button"),
		    hook("click", Controller.clickLeftEvent),
		    text("◀")
		]),
		elem("button", [
		    cl("button"),
		    hook("click", Controller.clickRightEvent),
		    text("▶")
		])))
    ];
}

function alert(state) {
    if (state.alert.text == "")
	return [];
    return elem("p", [
	cl("alert", alertClass(state.alert.type)),
	hook("click", Controller.clickAlertEvent),
	text(state.alert.text)
    ]);
}

function dialog(state) {
    switch (state.screen) {
    case Controller.Screens.browse:
	return [];
    case Controller.Screens.trash:
	return trash_dialog(state);
    case Controller.Screens.config:
	return config_dialog(state);
    case Controller.Screens.subscribe:
	return subscribe_dialog(state);
    default:
	return reload_dialog(state);
    }
}

function reload_dialog(state) {
    return custom_form(Controller.clickReloadEvent, null, [
	elem("p", text("AirSS is shut down. Reload?"))
    ]);
}

function subscribe_dialog(state) {
    return custom_form(
	Controller.submitSubscribeEvent,
	Controller.resetDialogEvent,
	div(cl("field", "long"),
	    elem("label", [
		text("The URL to the feed or the index page:"),
		elem("input",
		     attr({
			 type: "text",
			 class: "long",
			 name: Subscribe.feedUrl,
			 placeholder: "enter the url to subscribe"
		     }))
	    ])));
}

function trash_dialog(state) {
    return custom_form(Controller.submitTrashEvent, Controller.resetDialogEvent, [
	elem("p", [
	    cl("line"),
	    text("Are you sure you want to delete this item?")
	]),
	div(cl("field"),
	    elem("label", [
		text("Unsubscribe "),
		elem("span", [
		    cl("focus"),
		    text(state.currentItem.feedTitle)
		]),
		text(" too"),
		elem("input", [
		    attr({
			type: "checkbox",
			name: Trash.shouldUnsubscribe,
			checked: !dummy(state.currentItem)
		    })
		])
	    ]))
    ]);
}

function config_dialog(state) {
    return custom_form(Controller.submitConfigEvent, Controller.resetDialogEvent, [
	div(cl("field", "long"),
	    elem("label", [
		text("Load more when unread items is below:"),
		elem("select", [
		    attr({name: Config.waterMark}),
		    water_mark_options()
		])
	    ])),
	div(cl("field", "long"),
	    elem("label", [
		text("Between reloading a feed, wait at least:"),
		elem("select", [
		    attr({name: Config.minReloadWait}),
		    min_reload_wait_options()
		])
	    ])),
	div(cl("field", "long"),
	    elem("label", [
		text("Keep read items in the database for:"),
		elem("select", [
		    attr({name: Config.maxKeptPeriod}),
		    max_kept_period_options()
		])
	    ])),
	div(cl("field", "long"),
	    elem("label", [
		text("Keep in the database at most per feed:"),
		elem("select", [
		    attr({name: Config.maxItemsPerFeed}),
		    max_items_per_feed_options()
		])
	    ])),
	div(cl("field", "long"),
 	    elem("label", [
		text("Truncate each feed while loading to at most:"),
		elem("select", [
		    attr({name: Config.truncateItemsPerFeed}),
		    truncate_items_per_feed_options()
		])
	    ])),
	div(cl("field", "long"),
	    elem("label", [
		elem("span", [
		    text("Load feeds with roastidio.us ("),
		    elem("a", [
			attr({href: "https://github.com/derek-zhou/airss#Proxy"}),
			text("Why")
		    ]),
		    text("):")
		]),
		elem("input", [
		    attr({
			type: "checkbox",
			name: Config.bounceLoad,
			checked: bounceLoadDefault()
		    })
		])
	    ])),
	div(cl("field", "long"),
	    elem("label", [
		text("Restore feeds from:"),
		elem("input", [
		    attr({type: "text", name: Config.restoreHandle, class:"short code"})
		]),
		savedHandlePrompt(state)
	    ])),
	div(cl("field", "long"),
	    elem("label", [
		cl("alert", "alert-danger"),
		text("Danger! Type \"clear database\" to delete all data"),
		elem("input", attr({type: "text", name: Config.clearDatabase}))
	    ]))
    ]);
}

function savedHandlePrompt(state) {
    if (!state.postHandle)
	return [];
    return [
	text("Your feeds were saved to: "),
	elem("span", [
	    cl("code"),
	    text(state.postHandle)
	])
    ];
}

function bounceLoadDefault() {
    return localStorage.getItem("BOUNCE_LOAD") != "false";
}

function water_mark_options() {
    return build_options([
	{value: 1, text: "1 item"},
	{value: 10, text: "10 items"},
	{value: 100, text: "100 items"},
	{value: 1000, text: "1000 items"}
    ], parseInt(localStorage.getItem("WATER_MARK")) || 1);
}

function min_reload_wait_options() {
    return build_options([
	{value: 1, text: "1 hour"},
	{value: 4, text: "4 hours"},
	{value: 12, text: "12 hours"},
	{value: 24, text: "24 hours"}
    ], parseInt(localStorage.getItem("MIN_RELOAD_WAIT")) || 12);
}

function max_kept_period_options() {
    return build_options([
	{value: 30, text: "30 days"},
	{value: 60, text: "60 days"},
	{value: 180, text: "180 days"},
	{value: 999, text: "999 days"}
    ], parseInt(localStorage.getItem("MAX_KEPT_PERIOD")) || 180);
}

function max_items_per_feed_options() {
    return build_options([
	{value: 25, text: "25 items"},
	{value: 50, text: "50 items"},
	{value: 100, text: "100 items"},
	{value: 200, text: "200 items"}
    ], parseInt(localStorage.getItem("MAX_ITEMS_PER_FEED")) || 100);
}

function truncate_items_per_feed_options() {
    return build_options([
	{value: 1, text: "1 item"},
	{value: 10, text: "10 items"},
	{value: 25, text: "25 items"},
	{value: 100, text: "100 items"}
    ], parseInt(localStorage.getItem("TRUNCATE_ITEMS_PER_FEED")) || 25);
}

function build_options(options, default_value) {
    return options.map((each) =>
	elem("option", [
	    attr({value: each.value}),
	    each.value == default_value ? attr({selected: true}) : [],
	    text(each.text)
	])
    );
}

function custom_form(submit_action, reset_action, inner) {
    return shadow_div(
	elem("form", [
	    hook("submit", submit_action),
	    reset_action ? hook("reset", reset_action) : [],
	    elem("section", inner),
	    div(cl("toolbar"),
		submit_button(),
		reset_action ? reset_button() : [])
	]),
	elem("link", attr({rel: "stylesheet", href: "preflight.css"})),
	elem("link", attr({rel: "stylesheet", href: "dialog.css"})));
}

function submit_button() {
    return elem("input", [attr({type: "submit", value: "👌", class: "button"})]);
}

function reset_button() {
    return elem("input", [attr({type: "reset", value: "👎", class: "button"})]);
}

function article(state) {
    const item = state.currentItem;
    const hidden = state.screen != Controller.Screens.browse;

    if (item === undefined || hidden)
	return [];

    return [
	cl("article-viewport"),
	div(cl("article-container"),
	    item ? article_head(item) : [],
	    shadow_div(article_content(item),
		   elem("link", attr({rel: "stylesheet", href: "preflight.css"})),
		   elem("link", attr({rel: "stylesheet", href: "article.css"})))),
	item ? article_tail(item) : []
    ];
}

function article_head(item) {
    return [
	article_image(item),
	article_title(item),
	article_byline(item)
    ];
}

function article_image(item) {
    const imageUrl = item.imageUrl || Assets.unknownLinkImage;
    const hero_class = item.imageUrl ? "article-hero" : "article-antihero";

    return div(cl(hero_class),
	       elem("a", [
		   attr({href: item.url, target: "_blank", rel: "noopener noreferrer"}),
		   elem("img", [attr({src: imageUrl, alt: "thumbnail"})])
	       ]));
}

function article_title(item) {
    const title_text = text(item.title)

    return elem("h4", [
	cl("article-title"),
	dummy(item) ? title_text : make_link(title_text, item.url)
    ]);
}

function make_link(inner, url) {
    return elem("a", [
	attr({href: url, target: "_blank", rel: "noopener noreferrer"}),
	inner
    ]);
}

function article_byline(item) {
    return elem("h5", [
	cl("article-byline"),
	elem("span", text(item.feedTitle)),
	elem("span", text(" | ")),
	elem("span", text(item.datePublished.toLocaleString()))
    ]);
}

function article_tail(item) {
    if (dummy(item)) {
	return elem("form", [
	    cl("comment-form"),
	    div(cl("toolbar"), trash_button())
	]);
    }
    return elem("form", [
	attr({
	    method: "post",
	    action: "https://roastidio.us/post",
	    target: "_blank",
	    class: "comment-form"
	}),
	elem("input", attr({type: "hidden", name: "url", value: item.url})),
	elem("textarea", [
	    attr({name: "content"}),
	    hook("keydown", stopPropagation),
	    hook("input", autoAdjustHeight)
	]),
	div(cl("toolbar"),
	    trash_button(),
	    refresh_button(),
	    roast_button())
    ]);
}

function trash_button() {
    return elem("button", [
	cl("button"),
	hook("click", Controller.clickTrashEvent),
	text("🗑 ")
    ]);
}

function refresh_button() {
    return elem("button", [
	cl("button"),
	hook("click", Controller.clickRefreshEvent),
	text("📃")
    ]);
}

function roast_button() {
    return elem("input", [attr({type: "submit", value: "🔥", class:"button"})]);
}

function dialog_style() {
    return [
    ];
}

function article_content(item) {
    if (!item)
	return dummy_article();

    return [
	fill(item.contentHtml),
	dummy(item) ? [] : (node) => fixup_links(node, item.url)
    ];
}

function dummy_article() {
    return [
	elem("h2", text("No news is bad news")),
	elem("p", [
	    text("Airss is a web feed reader that runs entirely in your browser. You can subscribe any feeds by clicking the 🍼 button from above and paste the URL, or you can use of one of the following tricks: ")
	]),
	elem("h3", text("Desktop browser users")),
	elem("p", [
	    text("Install this bookmarklet "),
	    elem("a", [
		attr({
		    href: "javascript:location.href='{airssPrefix}?url='+encodeURIComponent(window.location.href)",
		    class: "button"
		}),
		text(" Subscribe it in Airss")
	    ]),
	    text(" "),
	    elem("b", text("by dragging it to your bookmarks")),
	    text(". Whenever you encounter something interesting on the web, be it a blog, a news website or whatever, you can click this bookmarklet to subscribe. Chances are they support RSS feeds so you will always stay updated.")
	]),
	elem("h3", text("Mobile browser users")),
	elem("p", [
	    text("Android users can install this APP: "),
	    elem("a", [
		attr({href: "https://f-droid.org/en/packages/net.daverix.urlforward/"}),
		text("URL Forwarder")
	    ]),
	    text(" (Thank you, David Laurell!) then add a filter as:")
	]),
	elem("pre", text("https://airss.roastidio.us/?url=@url")),
	elem("p", [
	    text("Then you can share links to the APP and select the menu to subscribe, if it support RSS feeds.")
	]),
	elem("p", [
	    text("iOS Safari users can use the bookmarklet method as mentioned earlier by syncing the bookmarklet from your Mac.")
	]),
	elem("h2", text("To my fellow bloggers")),
	elem("p", [
	    text("Please make sure you have your feed "),
	    elem("a", [
		attr({href: "https://www.rssboard.org/rss-autodiscovery"}),
		text("auto-discoverable")
	    ]),
	    text(" from your homepage. And if you can, please enable "),
	    elem("a", [
		attr({href: "https://enable-cors.org/"}),
		text("permissive CORS")
	    ]),
	    text(" on your blog to reach out to a broader audience. Lastly, if you really like Airss, you can put a link on your homepage:")
	]),
	elem("pre", [
	    text("<a href=\"https://airss.roastidio.us/?subscribe-referrer\" referrerpolicy=\"no-referrer-when-downgrade\">Follow me with Airss!</a>")
	]),
	elem("p", text("So your readers can have an even easier time to follow you."))
    ];
}
