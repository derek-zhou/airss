<script>

 // stores
 import {length, cursor, alertText, alertType,
	 currentItem, running} from './airss_controller.js';

 import { afterUpdate } from 'svelte';
 
 // functions
 import {forwardItem, backwardItem, deleteItem, subscribe, unsubscribe, clearData} from  './airss_controller.js';

 // constants
 // screen is fundimental content shown in the window
 const Screens = {
     browse: 1,
     shuutdown: 2,
     subscribe: 3,
     trash: 4,
     config: 5
 };
 const UnknownImage = "/images/unknown_link.png";
 const roastPrefix = "https://roastidio.us/roast?url=";
 const airssPrefix = "https://airss.roastidio.us/";

 // fundimental states of the app
 let screen = Screens.browse;

 // form value
 let subscribeUrl = "";
 let shouldUnsubscribe = false;

 let waterMark;
 let waterMarkChoices = [
     {value: 0, text: "0 items"},
     {value: 10, text: "10 items"},
     {value: 100, text: "100 items"},
     {value: 1000, text: "1000 items"}
 ];
 let waterMarkCurrent = localStorage.getItem("WATER_MARK") || 10;

 let minReloadWait;
 let minReloadWaitChoices = [
     {value: 1, text: "1 hour"},
     {value: 4, text: "4 hours"},
     {value: 12, text: "12 hours"},
     {value: 24, text: "24 hours"}
 ];
 let minReloadWaitCurrent = localStorage.getItem("MIN_RELOAD_WAIT") || 12;
 
 let maxKeptPeriod;
 let maxKeptPeriodChoices = [
     {value: 30, text: "30 days"},
     {value: 60, text: "60 days"},
     {value: 180, text: "180 days"},
     {value: 999, text: "999 days"}
 ];
 let maxKeptPeriodCurrent = localStorage.getItem("MAX_KEPT_PERIOD") || 180;

 let maxItemsPerFeed;
 let maxItemsPerFeedChoices = [
     {value: 25, text: "25 items"},
     {value: 50, text: "50 items"},
     {value: 100, text: "100 items"},
     {value: 200, text: "200 items"}
 ];
 let maxItemsPerFeedCurrent = localStorage.getItem("MAX_ITEMS_PER_FEED") || 100;

 let bounceLoad = localStorage.getItem("BOUNCE_LOAD") == "true";

 let apiKey = localStorage.getItem('AIRTABLE_API_KEY') || "";
 let baseToken = localStorage.getItem('AIRTABLE_BASE_TOKEN') || "";
 let clearDatabase = "";

 let xDown = null;
 let yDown = null;

 // derived state
 $: leftDisabled = ($cursor <= 0) || (screen != Screens.browse);
 $: rightDisabled = ($cursor >= $length - 1) || (screen != Screens.browse);
 $: screen = !$running ? Screens.shutdown : screen;
 $: alertClass = alertClassFromType($alertType);
 $: dummy = isDummyItem($currentItem);

 afterUpdate(() => {
     let container = document.querySelector("#content_html");
     if (!container)
	 return;
     if (!$currentItem)
	 return;
     let baseUrl = $currentItem.url;
     try {
	 let url = new URL(baseUrl);
     } catch (e) {
	 console.warn(baseUrl + " is not a valid url");
	 return;
     }
     // fix up all img's src
     for (let img of container.querySelectorAll("img").values()) {
	 let href = img.getAttribute("src");
	 try {
	     let absUrl = new URL(href, baseUrl);
	     img.setAttribute("src", absUrl.toString());
	 } catch (e) {
	     console.warn(href + "is not a valid link");
	 }
     }
     // fixup all a's href
     for (let link of container.querySelectorAll("a").values()) {
	 let href = link.getAttribute("href");
	 try {
	     let absUrl = new URL(href, baseUrl);
	     link.setAttribute("href", absUrl.toString());
	 } catch (e) {
	     console.warn(href + "is not a valid link");
	 }
     }
 });

 // view functions

 function isDummyItem(item) {
     if (!item)
	 return false;
     let tags = item.tags;
     return tags.length == 1 && tags[0] == "_error";
 }

 function alertClassFromType(type) {
     switch (type) {
	 case "error":
	     return "alert alert-danger";
	 case "warning":
	     return "alert alert-warning";
	 default:
	     return "alert alert-info";
     }
 }

 function clickLeft() {
     window.scrollTo({ top: 0, behavior: 'smooth' });
     backwardItem();
 }

 function clickRight() {
     window.scrollTo({ top: 0, behavior: 'smooth' });
     forwardItem();
 }

 function browseTouchStart(evt) {
     xDown = evt.touches[0].clientX;
     yDown = evt.touches[0].clientY;
 }

 function browseTouchMove(evt) {
     if ( ! xDown || ! yDown ) {
         return;
     }
     var xUp = evt.touches[0].clientX;
     var yUp = evt.touches[0].clientY;
     var xDiff = xDown - xUp;
     var yDiff = yDown - yUp;

     /*most significant*/
     if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
	 if ( xDiff > 0 ) {
	     /* left swipe */
	     clickRight();
	 } else {
	     /* right swipe */
	     clickLeft();
	 }
     }
     /* reset values */
     xDown = null;
     yDown = null;
 }

 function clickReload() {
     location.reload();
 }

 function clearAlert() {
     $alertText = "";
 }

 function clickConfig() {
     clearAlert();
     screen = Screens.config;
 }

 function clickSubscribe() {
     clearAlert();
     screen = Screens.subscribe;
 }

 function clickTrash() {
     clearAlert();
     screen = Screens.trash;
 }

 function clickConfirmDelete() {
     if (shouldUnsubscribe)
	 unsubscribe($currentItem.feedId);
     deleteItem();
     screen = Screens.browse;
 }

 function clickSubmitSubscribe() {
     subscribe(subscribeUrl);
     screen = Screens.browse;
 }

 function clickSubmitConfig() {
     // airss_model:
     localStorage.setItem("WATER_MARK", waterMark.value);
     localStorage.setItem("MIN_RELOAD_WAIT", minReloadWait.value);
     localStorage.setItem("MAX_KEPT_PERIOD", maxKeptPeriod.value);
     localStorage.setItem("MAX_ITEMS_PER_FEED", maxItemsPerFeed.value);
     localStorage.setItem("BOUNCE_LOAD", bounceLoad);
     // airtable_server
     localStorage.setItem("AIRTABLE_API_KEY", apiKey);
     localStorage.setItem("AIRTABLE_BASE_TOKEN", baseToken);
     // It is very hard to change config at run time, so I just take
     // shortcut to reload
     if (clearDatabase == "clear database") {
	 clearData().then(() => {
	     location.reload();
	 });
     } else {
	 location.reload();
     }
 }

 function clickCancel() {
     clearAlert();
     screen = Screens.browse;
 }

</script>

<svelte:head>
    <title>AirSS Reader({$cursor+1}/{$length})</title>
</svelte:head>

<div id="layout" class="viewport">
    <div class="header">
	<div class="brand">
	    <span class="title">AirSS</span>
	    <span class="info">{$cursor+1}/{$length}</span>
	</div>
      <div class="nav">
	  <button class="button"
			 on:click={clickConfig}>🔧</button>
	  <button class="button"
		  on:click={clickSubscribe}>🍼</button>
	  <button class="button"
		  disabled={leftDisabled}
		  on:click={clickLeft}>◀</button>
	  <button class="button"
		  disabled={rightDisabled}
		  on:click={clickRight}>▶</button>
      </div>
  </div>
  <p class={alertClass} role="alert" on:click={clearAlert}>{@html $alertText}</p>
  <div class="content">
  {#if screen == Screens.browse}
      <div class="box"
	   on:touchstart|passive={browseTouchStart}
	   on:touchmove|passive={browseTouchMove}>
	  {#if $currentItem}
	      {#if !dummy}
		  <div class={$currentItem.imageUrl ? "thumbnail" : "thumbnail-missing"}>
		      <a href={$currentItem.url} target="_blank" rel="noopener noreferrer">
			  <img src={$currentItem.imageUrl ? $currentItem.imageUrl : UnknownImage}
			       alt="thumbnail"/>
		      </a>
		  </div>
	      {/if}
	      <h4 class="title">
		  {#if dummy}
		      {$currentItem.title}
		  {:else}
		      <a href={$currentItem.url} target="_blank" rel="noopener noreferrer">
                          {$currentItem.title}</a>
		  {/if}
	      </h4>
	  <h5 class="tag-line">
	      <span class="site">{$currentItem.feedTitle}</span>
	      <span class="site">
		  | {$currentItem.datePublished.toLocaleString()}
	      </span>
	      {#if !dummy}
		  {#each $currentItem.tags as tag}
                      <span class="site"> | {tag} </span>
		  {/each}
	      {/if}
	  </h5>
	  <p id="content_html" class="desc">
	      {@html $currentItem.contentHtml}
	  </p>
	  <div class="toolbar">
	      <button class="button button-danger"
		      on:click={clickTrash}>🗑</button>
	      {#if !dummy}
		  <a class="button" target="roast"
		     href={roastPrefix + encodeURIComponent($currentItem.url)}>🔥</a>
	      {/if}
	  </div>
	  {:else if $length == 0}
	  <h2>No news is bad news</h2>
	  <p>
	      AirSS is a <a href="https://en.wikipedia.org/wiki/Web_feed">web feed</a> reader that runs entirely in your browser. For a detail description, please visit its <a href="https://github.com/derek-zhou/airss">Github page.</a>
	  </p>
	  <h3>Desktop browser users</h3>
	  <p>
	      Install this bookmarklet <a class="button" href="javascript:location.href='{airssPrefix}?url='+encodeURIComponent(window.location.href)">Subscribe it in AirSS</a> by <b>dragging</b> it to your bookmarks. Whenever you encounter something interesting on the web, be it a blog, a news website or whatever, you can click this bookmarklet to subscribe. Chances are they support RSS feeds so you will always stay updated.
	  </p>
	  <h3>Mobile browser users</h3>
	  <p>
	      Android users can install this app: <a href="https://play.google.com/store/apps/details?id=net.daverix.urlforward">URL Forwarder</a> (Thank you, David Laurell!) then add a filter as:
	  </p>
	  <pre>
{airssPrefix}?url=@url
	  </pre>
	  <p>
	      Then you can share links here to subscribe. Chances are they support RSS feeds so you will always stay updated.
	  </p>
	  <h3>Bloggers</h3>
	  <p>
	      Please make sure you have your feed <a href="https://www.rssboard.org/rss-autodiscovery">auto-discoverable</a> from your homepage. And if you can, please enable <a href="https://enable-cors.org/">permissive CORS</a> on your blog to reach out to a broader audience. Lastly, if you really like AirSS, you can put a link on your homepage:
	  </p>
	  <pre>
	      {'<a href="'+airssPrefix+'?subscribe-referrer" referrerpolicy="no-referrer-when-downgrade">Follow me with AirSS!</a>'}
	  </pre>
	  <p>
	      So your readers can have an even easier time to follow you.
	  </p>
	  {:else}
	  <h4>
	      News are here. You can
	      <button class="button"
		      on:click={clickRight}>forward</button>
	      to read
	  </h4>
	  {/if}
      </div>
  {:else if screen == Screens.shutdown}
      <button class="button"
	      on:click={clickReload}>Reload</button>
  {:else if screen == Screens.trash}
      <form on:submit|preventDefault={clickConfirmDelete}>
	  <p>
	      Are you sure you want to delete this item?
	  </p>
	  <div class="field">
	      <label for="check-unsubscribe">
		  Unsubscribe <span class="focus">{$currentItem.feedTitle}</span> too
	      </label>
	      <input type="checkbox" id="check-unsubscribe"
		     name="ckeck-unsubscribe"
		     bind:checked={shouldUnsubscribe}>
	  </div>
	  <div class="toolbar">
	      <input class="button" type="submit" value="👌">
	      <input class="button" type="reset" value="👎"
		     on:click={clickCancel}>
	  </div>
      </form>
  {:else if screen == Screens.config}
      <form on:submit|preventDefault={clickSubmitConfig}>
	  <div class="field">
	      <label for="select-water-mark">
		  Load more when unread items is below:
	      </label>
	      <select id="select-water-mark" bind:value={waterMark}>
		  {#each waterMarkChoices as choice}
		      <option selected={choice.value == waterMarkCurrent}
			      value={choice}>{choice.text}</option>
		  {/each}
	      </select>
	  </div>
	  <div class="field">
	      <label for="select-min-reload-wait">
		  Between reloading a feed, wait at least:
	      </label>
	      <select id="select-min-reload-wait" bind:value={minReloadWait}>
		  {#each minReloadWaitChoices as choice}
		      <option selected={choice.value == minReloadWaitCurrent}
			      value={choice}>{choice.text}</option>
		  {/each}
	      </select>
	  </div>
	  <div class="field">
	      <label for="select-max-kept-period">
		  Keep read items in the database for:
	      </label>
	      <select id="select-max-kept-period" bind:value={maxKeptPeriod}>
		  {#each maxKeptPeriodChoices as choice}
		      <option selected={choice.value == maxKeptPeriodCurrent}
			      value={choice}>{choice.text}</option>
		  {/each}
	      </select>
	  </div>
	  <div class="field">
	      <label for="select-max-items-per-feed">
		  Keep in the database at most per feed:
	      </label>
	      <select id="select-max-items-per-feed" bind:value={maxItemsPerFeed}>
		  {#each maxItemsPerFeedChoices as choice}
		      <option selected={choice.value == maxItemsPerFeedCurrent}
			      value={choice}>{choice.text}</option>
		  {/each}
	      </select>
	  </div>
	  <hr />
	  <div class="field">
	      <label for="input-bounce-load">
		  Load feeds with roastidio.us (<a href="https://github.com/derek-zhou/airss#Proxy">Why</a>):
	      </label>
	      <input id="input-bounce-load" type="checkbox" bind:checked={bounceLoad}>
	  </div>
	  <hr />
	  <div class="field">
	      <label for="input-api-key">
		  Your Airtable API key:
	      </label>
	      <input id="input-api-key" type="text" bind:value={apiKey}>
	  </div>
	  <div class="field">
	      <label for="input-base-token">
		  The ID of your base:
	      </label>
	      <input id="input-base-token" type="text" bind:value={baseToken}>
	  </div>
	  {#if baseToken}
	      <div class="footnote">
		  <a href="https://airtable.com/{baseToken}">
		      https://airtable.com/{baseToken}
		  </a>
	      </div>
	  {/if}
	  <div class="field alert alert-danger">
	      <label for="input-clear-database">Danger! Type "clear database" to delete all data</label>
	      <input id="input-clear-database" type="text" bind:value={clearDatabase}>
	  </div>
	  <div class="toolbar">
	      <input class="button" type="submit" value="👌">
	      <input class="button" type="reset" value="👎"
		     on:click={clickCancel}>
	  </div>
      </form>
  {:else if screen == Screens.subscribe}
      <form on:submit|preventDefault={clickSubmitSubscribe}>
	  <div class="field">
	      <label for="input-feed-url">
		  The URL to the feed or the index page:
	      </label>
	      <input id="input-feed-url" type="text"
		     bind:value={subscribeUrl}
		     placeholder="enter the url to subscribe">
	  </div>
	  <div class="toolbar">
	      <input class="button" type="submit" value="👌">
	      <input class="button" type="reset" value="👎"
		     on:click={clickCancel}>
	  </div>
      </form>
  {/if}
  </div>
  <div class="footer">
      <div class="links">
	  <a href="https://roastidio.us/roast" referrerpolicy="no-referrer-when-downgrade">Roast me at Roastidious</a>
      </div>
      <div class="copyright">
	  <a href="https://github.com/derek-zhou/airss" referrerpolicy="no-referrer-when-downgrade">Fork me on GitHub</a>
      </div>
  </div>
</div>
