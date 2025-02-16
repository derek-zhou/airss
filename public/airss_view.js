import {Screens} from "./airss_controller.js";
import {Assets} from "./assets.js";

// events that I emit
import {touchStartEvent, touchMoveEvent, clickLeftEvent, clickRightEvent, clickAlertEvent,
	clickConfigEvent, clickSubscribeEvent, clickTrashEvent, clickRefreshEvent,
	clickReloadEvent, submitSubscribeEvent, submitTrashEvent, submitConfigEvent,
	resetDialogEvent} from "./airss_controller.js";

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

// ids used in HTML
const ProgressBarID = "progress-bar";
const AlertBoxID = "alert-box";
const ApplicationID = "application";
const ArticleID = "article";
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

function clear_content(container) {
    const junk = [];
    for (const child of container.childNodes) {
	junk.push(child);
    }
    for (const elem of junk) {
	elem.remove();
    }
}

function repaint(container, transformations) {
    clear_content(container);
    for (const transform of transformations)
	transform(container);
}

function hook(type, event) {
    return (node) => node.addEventListener(type, (e) => {
	e.preventDefault();
	event(e);
    });
}

function text(t) {
    return (node) => node.append(document.createTextNode(t));
}

function elem(tag, transformations) {
    return (node) => node.append(build_elem(tag, transformations));
}

function attr(attributes) {
    return (node) => set_attrs(node, attributes);
}

function set_attrs(node, attributes) {
    for (const key in attributes) {
	const value = attributes[key];
	if (Array.isArray(value) && value.length > 0) {
	    node.setAttribute(key, value.join(" "));
	} else if (value){
	    node.setAttribute(key, value);
	}
    }
}

function build_elem(tag, transformations) {
    const element = document.createElement(tag);
    for (const transform of transformations)
	transform(element);
    return element;
}

function buildValue(value) {
    if (Array.isArray(value)) {
	return value.join(" ");
    } else {
	return value;
    }
}

function leftDisabled(state) {
    return state.cursor <= 0 || state.screen != Screens.browse;
}

function rightDisabled(state) {
    return state.cursor >= state.length - 1 || state.screen != Screens.browse;
}

function alertClass(state) {
    switch (state.alert.type) {
    case "error":
	return ["alert", "alert-danger"];
    case "warning":
	return ["alert", "alert-warning"];
    default:
	return ["alert", "alert-info"];
    }
}

// render everything from scratch
export function render_all(state) {
    repaint(document.body, body(state));
}

// render only the application container
export function render_application(state) {
    repaint(document.getElementById(ApplicationID), application(state));
}

// render only the article container
export function render_article(state) {
    repaint(document.getElementById(ArticleID), article(state));
    window.scrollTo({top: 0});
}

// render only the alert container
export function render_alert(state) {
    repaint(document.getElementById(AlertBoxID), alert(state));
    window.scrollTo({top: 0});
}

// update visibility of various blocks
export function update_layout(state) {
    update_hidden(document.getElementById(ArticleID), state.screen != Screens.browse);
    update_hidden(document.getElementById(ProgressBarID), !state.loading);
    update_hidden(document.getElementById(AlertBoxID), state.alert.text == "");
}

function update_hidden(node, should_hide) {
    if (should_hide) {
	node.setAttribute("hidden", true);
    } else {
	node.removeAttribute("hidden");
    }
}

function body(state) {
    return [
	elem("div", [
	    attr({id: ProgressBarID, class: "hidable", hidden: true})
	]),
	elem("div", [
	    attr({class: "viewport"}),
	    hook("touchstart", touchStartEvent),
	    hook("touchmove", touchMoveEvent),
	    elem("div", [
		attr({id: AlertBoxID, class: "hidable", hidden: true}),
		...alert(state)
	    ]),
	    elem("div", [
		attr({id: ApplicationID}),
		...application(state)
	    ]),
	    elem("div", [
		attr({id: ArticleID, class: "hidable article-viewport"}),
		...article(state)
	    ]),
	    elem("div", [
		attr({class: "footer"}),
		...footer(state)
	    ])
	])
    ];
}

function footer(state) {
    return [
	elem("div", [
	    attr({class: "left-half"}),
	    elem("a", [
		attr({
		    href: "https://roastidio.us/roast",
		    referrerpolicy: "no-referrer-when-downgrade"
		}),
		text("Roast me at Roastidious")
	    ]),
	]),
	elem("div", [
	    attr({class: "right-half"}),
	    elem("a", [
		attr({
		    href: "https://github.com/derek-zhou/airss",
		    referrerpolicy: "no-referrer-when-downgrade"
		}),
		text("Fork me on GitHub")
	    ]),
	])
    ];
}

function application(state) {
    return [
	...navbar(state),
	...dialog(state)
    ];
}

function navbar(state) {
    return [
	elem("div", [
	    attr({class: "navbar"}),
	    elem("div", [
		elem("a", [
		    attr({href: "index.html"}),
		    elem("img", [
			attr({src: Assets.logoImage, class: "logo"})
		    ]),
		]),
		elem("span", [
		    attr({class: "info"}),
		    text(`${state.cursor+1}/${state.length}`)
		])
	    ]),
	    elem("div", [
		attr({class: "toolbar"}),
		elem("button", [
		    attr({class: "button"}),
		    hook("click", clickConfigEvent),
		    text("🔧")
		]),
		elem("button", [
		    attr({class: "button"}),
		    hook("click", clickSubscribeEvent),
		    text("🍼")
		]),
		elem("button", [
		    attr({class: "button"}),
		    hook("click", clickLeftEvent),
		    text("◀")
		]),
		elem("button", [
		    attr({class: "button"}),
		    hook("click", clickRightEvent),
		    text("▶")
		])
	    ])
	])
    ];
}

function alert(state) {
    if (state.alert.text == "") {
	return [];
    } else {
	return [
	    elem("p", [
		attr({class: alertClass(state)}),
		hook("click", clickAlertEvent),
		text(state.alert.text)
	    ])
	];
    }
}

function dialog(state) {
    switch (state.screen) {
    case Screens.browse:
	return [];
    case Screens.trash:
	return trash_dialog(state);
    case Screens.config:
	return config_dialog(state);
    case Screens.subscribe:
	return subscribe_dialog(state);
    default:
	return reload_dialog(state);
    }
}

function reload_dialog(state) {
    return [
	custom_form(clickReloadEvent, null, [
	    elem("p", [
		text("AirSS is shut down. Reload?")
	    ])
	])
    ];
}

function subscribe_dialog(state) {
    return [
	custom_form(submitSubscribeEvent, resetDialogEvent, [
	    elem("div", [
		attr({class: "field long"}),
		elem("label", [
		    text("The URL to the feed or the index page:"),
		    elem("input", [
			attr({
			    type: "text",
			    class: "long",
			    name: Subscribe.feedUrl,
			    placeholder: "enter the url to subscribe"
			})
		    ])
		])
	    ])
	])
    ];
}

function trash_dialog(state) {
    return [
	custom_form(submitTrashEvent, resetDialogEvent, [
	    elem("p", [
		attr({class: "line"}),
		text("Are you sure you want to delete this item?")
	    ]),
	    elem("div", [
		attr({class: "field"}),
		elem("label", [
		    text("Unsubscribe "),
		    elem("span", [
			attr({class: "focus"}),
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
		])
	    ])
	])
    ];
}

function config_dialog(state) {
    return [
	custom_form(submitConfigEvent, resetDialogEvent, [
	    elem("div", [
		attr({class: "field long"}),
		elem("label", [
		    text("Load more when unread items is below:"),
		    elem("select", [
			attr({name: Config.waterMark}),
			...water_mark_options()
		    ])
		])
	    ]),
	    elem("div", [
		attr({class: "field long"}),
		elem("label", [
		    text("Between reloading a feed, wait at least:"),
		    elem("select", [
			attr({name: Config.minReloadWait}),
			...min_reload_wait_options()
		    ])
		])
	    ]),
	    elem("div", [
		attr({class: "field long"}),
		elem("label", [
		    text("Keep read items in the database for:"),
		    elem("select", [
			attr({name: Config.maxKeptPeriod}),
			...max_kept_period_options()
		    ])
		])
	    ]),
	    elem("div", [
		attr({class: "field long"}),
		elem("label", [
		    text("Keep in the database at most per feed:"),
		    elem("select", [
			attr({name: Config.maxItemsPerFeed}),
			...max_items_per_feed_options()
		    ])
		])
	    ]),
	    elem("div", [
		attr({class: "field long"}),
		elem("label", [
		    text("Truncate each feed while loading to at most:"),
		    elem("select", [
			attr({name: Config.truncateItemsPerFeed}),
			...truncate_items_per_feed_options()
		    ])
		])
	    ]),
	    elem("div", [
		attr({class: "field long"}),
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
		])
	    ]),
	    elem("div", [
		attr({class: "field long"}),
		elem("label", [
		    text("Restore feeds from:"),
		    elem("input", [
			attr({
			    type: "text",
			    class: "short code",
			    name: Config.restoreHandle
			})
		    ]),
		    ...savedHandlePrompt(state)
		])
	    ]),
	    elem("div", [
		attr({class: "field long"}),
		elem("label", [
		    attr({class: "alert alert-danger"}),
		    text("Danger! Type \"clear database\" to delete all data"),
		    elem("input", [
			attr({type: "text", name: Config.clearDatabase})
		    ])
		])
	    ])
	])
    ];
}

function savedHandlePrompt(state) {
    if (state.postHandle) {
	return [
	    text("Your feeds were saved to: "),
	    elem("span", [attr({class: "code"}), text(state.postHandle)])
	];
    } else {
	return [];
    }
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
	    attr({selected: each.value == default_value, value: each.value}),
	    text(each.text)
	])
    );
}

function custom_form(submit_action, reset_action, inner) {
    return elem("form", [
	hook("submit", submit_action),
	... reset_action ? [hook("reset", reset_action)] : [],
	elem("section", inner),
	elem("div", [
	    attr({class: "toolbar"}),
	    submit_button(),
	    ... reset_action ? [reset_button()] : []
	])
    ]);
}

function submit_button() {
    return elem("input", [attr({class: "button", type: "submit", value: "👌"})]);
}

function reset_button() {
    return elem("input", [attr({class: "button", type: "reset", value: "👎"})]);
}

function article(state) {
    const item = state.currentItem;

    return [
	elem("div", [
	    attr({class: "article-container"}),
	    ... item ? article_head(item) : [],
	    elem("div", [
		attr({class: "content-html"}),
		...article_content(item)
	    ])
	]),
	... item ? article_tail(item) : []
    ];
}

function dummy(item) {
    if (!item)
	return true;
    const tags = item.tags;
    return tags.length == 1 && tags[0] == "_error";
}

function article_head(item) {
    return [
	... dummy(item) ? [] : article_image(item),
	... article_title(item),
	... article_byline(item)
    ];
}

function article_image(item) {
    if (item.imageUrl) {
	return [
	    elem("div", [
		attr({class: "article-hero"}),
		elem("a", [
		    attr({href: item.url, target: "_blank", rel: "noopener noreferrer"}),
		    elem("img", [attr({src: item.imageUrl, alt: "thumbnail"})])
		])
	    ])
	];
    } else {
	return [
	    elem("div", [
		attr({class: "article-antihero"}),
		elem("a", [
		    attr({href: item.url, target: "_blank", rel: "noopener noreferrer"}),
		    elem("img", [attr({src: Assets.unknownLinkImage, alt: "thumbnail"})])
		])
	    ])
	];
    }
}

function article_title(item) {
    if (dummy(item)) {
	return [elem("h4", [attr({class: "article-title"}), text(item.title)])];
    } else {
	return [
	    elem("h4", [
		attr({class: "article-title"}),
		elem("a", [
		    attr({href: item.url, target: "_blank", rel: "noopener noreferrer"}),
		    text(item.title)
		])
	    ])
	];
    }
}

function article_byline(item) {
    return [
	elem("h5", [
	    attr({class: "article-byline"}),
	    elem("span", [text(item.feedTitle)]),
	    elem("span", [text(" | ")]),
	    elem("span", [text(item.datePublished.toLocaleString())])
	])
    ];
}

function article_tail(item) {
    return [
	elem("form", [
	    attr({
		class: "comment-form",
		method: "post",
		action: "https://roastidio.us/post",
		target: "_blank"
	    }),
	    elem("input", [attr({type: "hidden", name: "url", value: item.url})]),
	    ... dummy(item) ? [] : comment_box(),
	    elem("div", [
		attr({class: "toolbar"}),
		trash_button(),
		... dummy(item) ? [] : [refresh_button()],
		... dummy(item) ? [] : [roast_button()]
	    ])
	])
    ];
}

function comment_box() {
    return [
	elem("textarea", [attr({name: "content"})]),
	(node) => {
	    const textarea = node.querySelector("textarea");
	    textarea.addEventListener("keydown", (e) => {
		e.stopImmediatePropagation();
	    });
	    textarea.addEventListener("input", () => {
		const offset = textarea.offsetHeight - textarea.clientHeight;
		textarea.style.height = textarea.scrollHeight + offset + 'px';
	    });
	}
    ];
}

function trash_button() {
    return elem("button", [
	attr({class: "button"}),
	hook("click", clickTrashEvent),
	text("🗑 ")
    ]);
}

function refresh_button() {
    return elem("button", [
	attr({class: "button"}),
	hook("click", clickRefreshEvent),
	text("📃")
    ]);
}

function roast_button() {
    return elem("input", [attr({class: "button", type: "submit", value: "🔥"})]);
}

function article_content(item) {
    if (item) {
	return [
	    (node) => {node.innerHTML = item.contentHtml},
	    ... dummy(item) ? [] : [(node) => fixup_links(node, item.url)]
	];
    } else {
	return dummy_article();
    }
}

function dummy_article() {
    return [
	elem("h2", [text("No news is bad news")]),
	elem("p", [
	    text("Airss is a web feed reader that runs entirely in your browser. You can subscribe any feeds by clicking the 🍼 button from above and paste the URL, or you can use of one of the following tricks: ")
	]),
	elem("h3", [text("Desktop browser users")]),
	elem("p", [
	    text("Install this bookmarklet "),
	    elem("a", [
		attr({
		    class: "button",
		    href: "javascript:location.href='{airssPrefix}?url='+encodeURIComponent(window.location.href)"
		}),
		text(" Subscribe it in Airss")
	    ]),
	    text(" "),
	    elem("b", [text("by dragging it to your bookmarks")]),
	    text(". Whenever you encounter something interesting on the web, be it a blog, a news website or whatever, you can click this bookmarklet to subscribe. Chances are they support RSS feeds so you will always stay updated.")
	]),
	elem("h3", [text("Mobile browser users")]),
	elem("p", [
	    text("Android users can install this APP: "),
	    elem("a", [
		attr({href: "https://f-droid.org/en/packages/net.daverix.urlforward/"}),
		text("URL Forwarder")
	    ]),
	    text(" (Thank you, David Laurell!) then add a filter as:")
	]),
	elem("pre", [text("https://airss.roastidio.us/?url=@url")]),
	elem("p", [
	    text("Then you can share links to the APP and select the menu to subscribe, if it support RSS feeds.")
	]),
	elem("p", [
	    text("iOS Safari users can use the bookmarklet method as mentioned earlier by syncing the bookmarklet from your Mac.")
	]),
	elem("h2", [text("To my fellow bloggers")]),
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
	elem("p", [text("So your readers can have an even easier time to follow you.")])
    ];
}
