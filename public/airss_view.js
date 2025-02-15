import {Screens} from './airss_controller.js';
import {Assets} from "./assets.js";

// events that I emit
export const Events = {
    touchStart: "AirSSViewTouchStart",
    touchMove: "AirSSViewTouchMove",
    clickLeft: "AirSSViewClickLeft",
    clickRight: "AirSSViewClickRight",
    clickAlert: "AirSSViewClickAlert",
    clickConfig: "AirSSViewClickConfig",
    clickSubscribe: "AirSSViewClickSubscribe",
    clickTrash: "AirSSViewClickTrash",
    clickRefresh: "AirSSViewClickRefresh",
    clickReload: "AirSSViewClickReload",
    submitSubscribe: "AirSSViewSubmitSubscribe",
    submitTrash: "AirSSViewSubmitTrash",
    submitConfig: "AirSSViewSubmitConfig",
    resetDialog: "AirSSViewResetDialog"
};

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
    for (let img of container.querySelectorAll("img").values()) {
	let href = img.getAttribute("src");
	try {
	    let absUrl = new URL(href, url);
	    img.setAttribute("src", absUrl.toString());
	} catch (e) {
	    console.warn(href + "is not a valid link");
	}
    }
    // fixup all a's href
    for (let link of container.querySelectorAll("a").values()) {
	let href = link.getAttribute("href");
	try {
	    let absUrl = new URL(href, url);
	    link.setAttribute("href", absUrl.toString());
	    link.setAttribute("target", "_blank");
	} catch (e) {
	    console.warn(href + "is not a valid link");
	}
    }
}

function clear_content(container) {
    let junk = [];
    for (const child of container.childNodes) {
	junk.push(child);
    }
    for (const elem of junk) {
	elem.remove();
    }
}

function repaint(container, tree) {
    clear_content(container);
    tree.forEach((each) => build_node(container, each));
}

function build_node(container, tree_node) {
    switch(typeof(tree_node)) {
    case "string":
	container.append(document.createTextNode(tree_node));
	break;
    case "function":
	tree_node(container);
	break;
    case "object":
	let element = document.createElement(tree_node.tag);
	if (tree_node.attributes) {
	    Object.keys(tree_node.attributes).forEach((key) => {
		let value = tree_node.attributes[key];
		if (Array.isArray(value) && value.length > 0) {
		    element.setAttribute(key, value.join(" "));
		} else if (value) {
		    element.setAttribute(key, value);
		}
	    });
	}
	if (tree_node.children) {
	    tree_node.children.forEach((each) => build_node(element, each));
	}
	container.append(element);
	break;
    }
}

function action(type, event) {
    if (!event) {
	return (node) => {};
    } else {
	return (node) => {
	    node.addEventListener(type, (e) => {
		e.preventDefault();
		document.dispatchEvent(new CustomEvent(event, {detail: e}));
	    });
	};
    }
}

function el(tag, attributes, children) {
    return {
	tag,
	... attributes == {} ? {} : {attributes},
	... children == [] ? {} : {children}
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
	return "alert alert-danger";
    case "warning":
	return "alert alert-warning";
    default:
	return "alert alert-info";
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
	el("div", {id: ProgressBarID, class: "hidable", hidden: true}, []),
	el("div", {class: "viewport"}, [
	    action("touchstart", Events.touchStart),
	    action("touchmove", Events.touchMove),
	    el("div", {id: AlertBoxID, class: "hidable", hidden: true}, alert(state)),
	    el("div", {id: ApplicationID}, application(state)),
	    el("div", {id: ArticleID, class: "hidable article-viewport"}, article(state)),
	    el("div", {class: "footer"}, footer(state))
	])
    ];
}

function footer(state) {
    return [
	el("div", {class: "left-half"}, [
	    el("a", {
		href: "https://roastidio.us/roast",
		referrerpolicy: "no-referrer-when-downgrade"}, [
		    "Roast me at Roastidious"
		]),
	]),
	el("div", {class: "right-half"}, [
	    el("a", {
		href: "https://github.com/derek-zhou/airss",
		referrerpolicy: "no-referrer-when-downgrade"}, [
		    "Fork me on GitHub"
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
	el("div", {class: "navbar"}, [
	    el("div", {}, [
		el("a", {href: "index.html"}, [
		    el("img", {src: Assets.logoImage, class: "logo"}, []),
		]),
		el("span", {class: "info"},
			[`${state.cursor+1}/${state.length}`])
	    ]),
	    el("div", {class: "toolbar"}, [
		el("button", {class: "button"}, [
		    action("click", Events.clickConfig),
		    "🔧"
		]),
		el("button", {class: "button"}, [
		    action("click", Events.clickSubscribe),
		    "🍼"
		]),
		el("button", {class: "button"}, [
		    action("click", Events.clickLeft),
		    "◀"
		]),
		el("button", {class: "button"}, [
		    action("click", Events.clickRight),
		    "▶"
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
	    el("p", {class: alertClass(state)}, [
		action("click", Events.clickAlert),
		state.alert.text
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
	custom_form(Events.clickReload, null, [
	    el("p", {}, ["AirSS is shut down. Reload?"])
	])
    ];
}

function subscribe_dialog(state) {
    return [
	custom_form(Events.submitSubscribe, Events.resetDialog, [
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "The URL to the feed or the index page:",
		    el("input", {type: "text", class: "long", name: Subscribe.feedUrl,
				 placeholder: "enter the url to subscribe"}, [])
		]),
	    ])
	])
    ];
}

function trash_dialog(state) {
    return [
	custom_form(Events.submitTrash, Events.resetDialog, [
	    el("p", {class: "line"}, ["Are you sure you want to delete this item?"]),
	    el("div", {class: "field"}, [
		el("label", {}, [
		    "Unsubscribe ",
		    el("span", {class: "focus"}, [state.currentItem.feedTitle]),
		    " too",
		    el("input", {type: "checkbox", name: Trash.shouldUnsubscribe,
				 checked: !dummy(state.currentItem)}, [])
		]),
	    ])
	])
    ];
}

function config_dialog(state) {
    return [
	custom_form(Events.submitConfig, Events.resetDialog, [
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Load more when unread items is below:",
		    el("select", {name: Config.waterMark},
		       water_mark_options())
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Between reloading a feed, wait at least:",
		    el("select", {name: Config.minReloadWait},
		       min_reload_wait_options())
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Keep read items in the database for:",
		    el("select", {name: Config.maxKeptPeriod},
		       max_kept_period_options())
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Keep in the database at most per feed:",
		    el("select", {name: Config.maxItemsPerFeed},
		       max_items_per_feed_options())
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Truncate each feed while loading to at most:",
		    el("select", {name: Config.truncateItemsPerFeed},
		       truncate_items_per_feed_options())
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    el("span", {}, [
			"Load feeds with roastidio.us (",
			el("a", {href: "https://github.com/derek-zhou/airss#Proxy"}, ["Why"]),
			"):"
		    ]),
		    el("input", {type: "checkbox", name: Config.bounceLoad,
				 checked: bounceLoadDefault()}, [])
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {}, [
		    "Restore feeds from:",
		    el("input", {type: "text", class: "short code",
				 name: Config.restoreHandle}, []),
		    ...savedHandlePrompt(state)
		])
	    ]),
	    el("div", {class: "field long"}, [
		el("label", {class: "alert alert-danger"}, [
		    "Danger! Type \"clear database\" to delete all data",
		    el("input", {type: "text", name: Config.clearDatabase}, [])
		])
	    ])
	])
    ];
}

function savedHandlePrompt(state) {
    if (state.postHandle) {
	return [
	    "Your feeds were saved to: ",
	    el("span", {class: "code"}, [state.postHandle])
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
	el("option", {selected: each.value == default_value, value: each.value}, [each.text])
    );
}

function custom_form(submit_action, reset_action, inner) {
    return el("form", {}, [
	action("submit", submit_action),
	action("reset", reset_action),
	el("section", {}, inner),
	el("div", {class: "toolbar"}, [
	    el("input", {class: "button", type: "submit", value: "👌"}, []),
	    ... reset_action ? [el("input", {class: "button", type: "reset", value: "👎"}, [])] : []
	])
    ]);
}

function article(state) {
    let item = state.currentItem;

    return [
	el("div", {class: "article-container"}, [
	    ... item ? article_head(item) : [],
	    el("div", {class: "content-html"}, article_content(item)),
	]),
	... item ? article_tail(item) : []
    ];
}

function dummy(item) {
    if (!item)
	return true;
    let tags = item.tags;
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
	    el("div", {class: "article-hero"}, [
		el("a", {href: item.url, target: "_blank", rel: "noopener noreferrer"}, [
		    el("img", {src: item.imageUrl, alt: "thumbnail"}, [])
		])
	    ])
	];
    } else {
	return [
	    el("div", {class: "article-antihero"}, [
		el("a", {href: item.url, target: "_blank", rel: "noopener noreferrer"}, [
		    el("img", {src: Assets.unknownLinkImage, alt: "thumbnail"}, [])
		])
	    ])
	];
    }
}

function article_title(item) {
    if (dummy(item)) {
	return [
	    el("h4", {class: "article-title"}, [item.title])
	];
    } else {
	return [
	    el("h4", {class: "article-title"}, [
		el("a", {href: item.url, target: "_blank", rel: "noopener noreferrer"},
		   [item.title])
	    ])
	];
    }
}

function article_byline(item) {
    return [
	el("h5", {class: "article-byline"}, [
	    el("span", {}, [item.feedTitle]),
	    el("span", {}, [" | "]),
	    el("span", {}, [item.datePublished.toLocaleString()])
	])
    ];
}

function article_tail(item) {
    return [
	el("form", {
	    class: "comment-form",
	    method: "post",
	    action: "https://roastidio.us/post",
	    target: "_blank"
	}, [
	    el("input", {type: "hidden", name: "url", value: item.url}, []),
	    ... dummy(item) ? [] : comment_box(),
	    el("div", {class: "toolbar"}, [
		trash_button(),
		... dummy(item) ? [] : [refresh_button()],
		... dummy(item) ? [] : [submit_button()]
	    ])
	])
    ];
}

function comment_box() {
    return [
	el("textarea", {name: "content"}, []),
	(node) => {
	    let textarea = node.firstElementChild;
	    textarea.addEventListener("keydown", (e) => {
		e.stopImmediatePropagation();
	    });
	    textarea.addEventListener("input", () => {
		let offset = textarea.offsetHeight - textarea.clientHeight;
		textarea.style.height = textarea.scrollHeight + offset + 'px';
	    });
	}
    ];
}

function trash_button() {
    return el("button", {class: "button"}, [
	action("click", Events.clickTrash),
	"🗑 "
    ]);
}

function refresh_button() {
    return el("button", {class: "button"}, [
	action("click", Events.clickRefresh),
	"📃"
    ]);
}

function submit_button() {
    return el("input", {class: "button", type: "submit", value: "🔥"}, []);
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
	el("h2", {}, ["No news is bad news"]),
	el("p", {}, [
	    "Airss is a web feed reader that runs entirely in your browser. You can subscribe any feeds by clicking the 🍼 button from above and paste the URL, or you can use of one of the following tricks: "
	]),
	el("h3", {}, ["Desktop browser users"]),
	el("p", {}, [
	    "Install this bookmarklet ",
	    el("a", {class: "button", href: "javascript:location.href='{airssPrefix}?url='+encodeURIComponent(window.location.href)"}, [
		" Subscribe it in Airss"
	    ]),
	    " ",
	    el("b", {}, ["by dragging it to your bookmarks"]),
	    ". Whenever you encounter something interesting on the web, be it a blog, a news website or whatever, you can click this bookmarklet to subscribe. Chances are they support RSS feeds so you will always stay updated."
	]),
	el("h3", {}, ["Mobile browser users"]),
	el("p", {}, [
	    "Android users can install this APP: ",
	    el("a", {href: "https://f-droid.org/en/packages/net.daverix.urlforward/"}, [
		"URL Forwarder"
	    ]),
	    " (Thank you, David Laurell!) then add a filter as:"
	]),
	el("pre", {}, ["https://airss.roastidio.us/?url=@url"]),
	el("p", {}, [
	    "Then you can share links to the APP and select the menu to subscribe, if it support RSS feeds."
	]),
	el("p", {}, [
	    "iOS Safari users can use the bookmarklet method as mentioned earlier by syncing the bookmarklet from your Mac."
	]),
	el("h2", {}, ["To my fellow bloggers"]),
	el("p", {}, [
	    "Please make sure you have your feed ",
	    el("a", {href: "https://www.rssboard.org/rss-autodiscovery"}, ["auto-discoverable"]),
	    " from your homepage. And if you can, please enable ",
	    el("a", {href: "https://enable-cors.org/"}, ["permissive CORS"]),
	    " on your blog to reach out to a broader audience. Lastly, if you really like Airss, you can put a link on your homepage:"
	]),
	el("pre", {}, [
	    "<a href=\"https://airss.roastidio.us/?subscribe-referrer\" referrerpolicy=\"no-referrer-when-downgrade\">Follow me with Airss!</a>"
	]),
	el("p", {}, ["So your readers can have an even easier time to follow you."])
    ];
}
