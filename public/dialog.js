import * as Controller from "./airss_controller.js";
import {Assets} from "./assets.js";
import {dummy} from "./airss_view.js";
import {hook, elem, text, attr, cl, div, shadow_div} from "./domfun.js";

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
	[Assets.preflightCSS, Assets.dialogCSS],
	elem("form", [
	    hook("submit", submit_action),
	    reset_action ? hook("reset", reset_action) : [],
	    elem("section", inner),
	    div(cl("toolbar"),
		submit_button(),
		reset_action ? reset_button() : [])
	])
    );
}

function submit_button() {
    return elem("input", [attr({type: "submit", value: "👌", class: "button"})]);
}

function reset_button() {
    return elem("input", [attr({type: "reset", value: "👎", class: "button"})]);
}
