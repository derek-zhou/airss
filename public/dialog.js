import * as Controller from "./airss_controller.js";
import * as Asset from './assets.js';
import {dummy} from "./airss_view.js";
import {hook, elem, text, attr, cl, div, style} from "./domfun.js";

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

export function dialog(state) {
    switch (state.screen) {
    case Controller.Screens.browse:
	return article_tail(state);
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
    return custom_form(
	Controller.clickReloadEvent,
	null,
	"AirSS is shut down",
	elem("p", text("AirSS is shut down. Reload?"))
    );
}

function subscribe_dialog(state) {
    return custom_form(
	Controller.submitSubscribeEvent,
	Controller.resetDialogEvent,
	"Subscribe to a feed:",
	div(
	    cl("line"),
	    elem("label", text("The URL to the feed or the index page: ")),
	    elem(
		"input",
		cl("long"),
		attr({
		    type: "text",
		    name: Subscribe.feedUrl,
		    placeholder: "enter the url to subscribe"
		})
	    )
	)
    );
}

function trash_dialog(state) {
    return custom_form(
	Controller.submitTrashEvent,
	Controller.resetDialogEvent,
	"Are you sure you want to delete this item?",
	div(
	    cl("line"),
	    elem("label", text("Unsubscribe ")),
	    elem(
		"span",
		cl("value"),
		text(state.currentItem.feedTitle)
	    ),
	    text(" too"),
	    elem(
		"input",
		attr({
		    type: "checkbox",
		    name: Trash.shouldUnsubscribe,
		    checked: !dummy(state.currentItem)
		})
	    )
	)
    );
}

function config_dialog(state) {
    return custom_form(
	Controller.submitConfigEvent,
	Controller.resetDialogEvent,
	"Modify configurations",
	[
	    div(
		cl("line"),
		elem("label", text("Load more when unread items is below: ")),
		elem(
		    "select",
		    attr({name: Config.waterMark}),
		    water_mark_options()
		)
	    ),
	    div(
		cl("line"),
		elem("label", text("Between reloading a feed, wait at least: ")),
		elem(
		    "select",
		    attr({name: Config.minReloadWait}),
		    min_reload_wait_options()
		)
	    ),
	    div(
		cl("line"),
		elem("label", text("Keep read items in the database for: ")),
		elem(
		    "select",
		    attr({name: Config.maxKeptPeriod}),
		    max_kept_period_options()
		)
	    ),
	    div(
		cl("line"),
		elem("label", text("Keep in the database at most per feed:")),
		elem(
		    "select",
		    attr({name: Config.maxItemsPerFeed}),
		    max_items_per_feed_options()
		)
	    ),
	    div(
		cl("line"),
 		elem("label", text("Truncate each feed while loading to at most:")),
		elem(
		    "select",
		    attr({name: Config.truncateItemsPerFeed}),
		    truncate_items_per_feed_options()
		)
	    ),
	    div(
		cl("line"),
		elem(
		    "label",
		    elem(
			"span",
			text("Load feeds with roastidio.us ("),
			elem(
			    "a",
			    attr({href: "https://github.com/derek-zhou/airss#Proxy"}),
			    text("Why")
			),
			text("):")
		    )
		),
		elem(
		    "input",
		    attr({
			type: "checkbox",
			name: Config.bounceLoad,
			checked: bounceLoadDefault()
		    })
		)
	    ),
	    div(cl("line"), savedHandlePrompt(state)),
	    div(
		cl("line"),
		elem("label", text("Restore feeds from: ")),
		elem(
		    "input",
		    cl("short", "code"),
		    attr({type: "text", name: Config.restoreHandle})
		)
	    ),
	    div(
		cl("line"),
		elem(
		    "label",
		    cl("alert", "alert-danger"),
		    text("Danger! Type \"clear database\" to delete all data")
		),
		elem("input", attr({type: "text", name: Config.clearDatabase}))
	    )
	]
    );
}

function savedHandlePrompt(state) {
    if (!state.postHandle) {
	return [
	    elem("label", text("Save your feeds: ")),
	    elem(
		"button",
		cl("button", "inline"),
		hook("click", Controller.clickSaveEvent),
		text("🗄")
	    )
	];
    } else {
	return [
	    elem("label", text("Your feeds were saved to: ")),
	    elem("span", cl("value", "code"), text(state.postHandle))
	];
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
	elem(
	    "option",
	    attr({value: each.value}),
	    each.value == default_value ? attr({selected: true}) : [],
	    text(each.text)
	)
    );
}

function custom_form(submit_action, reset_action, title, inner) {
    return div(
	style(Asset.at("commonCSS")),
	style(Asset.at("dialogCSS")),
	elem(
	    "form",
	    hook("submit", submit_action),
	    reset_action ? hook("reset", reset_action) : [],
	    div(
		cl("form-body"),
		elem("h2", text(title)),
		elem("section", inner)
	    ),
	    div(
		cl("toolbar"),
		submit_button(),
		reset_action ? reset_button() : []
	    )
	)
    );
}

function submit_button() {
    return elem("input", cl("button"), attr({type: "submit", value: "👌"}));
}

function reset_button() {
    return elem("input", cl("button"), attr({type: "reset", value: "👎"}));
}

function article_tail(state) {
    let item = state.currentItem;
    let url = item ? item.url : null;
    let real_item = item && !dummy(item);
    
    return div(
	style(Asset.at("commonCSS")),
	style(Asset.at("dialogCSS")),
	elem(
	    "form",
	    attr({
		method: "post",
		action: "https://roastidio.us/post",
		target: "_blank"
	    }),
	    div(
		cl("form-body"),
		elem("input", attr({type: "hidden", name: "url", value: item.url})),
		elem(
		    "textarea",
		    attr({name: "content"}),
		    hook("keydown", stopPropagation),
		    hook("focus", Controller.focus_element),
		    hook("blur", Controller.blur_element),
		    hook("input", autoAdjustHeight)
		)
	    ),
	    div(
		cl("toolbar"),
		elem(
		    "button",
		    cl("button", "convenient"),
		    real_item && !state.refreshing ? [] : attr({disabled: true}),
		    hook("click", Controller.clickRefreshEvent),
		    text("📃")
		),
		elem(
		    "input",
		    cl("button"),
		    real_item ? [] : attr({disabled: true}),
		    attr({type: "submit", value: "👌"})
		),
		elem(
		    "button",
		    cl("button", "danger"),
		    real_item ? [] : attr({disabled: true}),
		    hook("click", Controller.clickTrashEvent),
		    text("🗑 ")
		),
	    )
	)
    );
}

function stopPropagation(e) {
    e.stopImmediatePropagation();
}

function autoAdjustHeight(e) {
    const textarea = e.currentTarget;
    const offset = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = textarea.scrollHeight + offset + 'px';
}
