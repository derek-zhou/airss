<script>

 // stores
 import {length, cursor, alertText, alertType,
	 currentItem, running, postHandle} from './airss_controller.js';

 // functions
 import {forwardItem, backwardItem, deleteItem, refreshItem, subscribe, unsubscribe,
	 clearData, saveFeeds, restoreFeeds} from  './airss_controller.js';

 import { afterUpdate } from 'svelte';

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
 const roastidious = "https://roastidio.us";
 const roastPrefix = roastidious + "/roast?url=";
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

 let truncateItemsPerFeed;
 let truncateItemsPerFeedChoices = [
     {value: 1, text: "1 item"},
     {value: 10, text: "10 items"},
     {value: 25, text: "25 items"},
     {value: 100, text: "100 items"}
 ];
 let truncateItemsPerFeedCurrent = localStorage.getItem("TRUNCATE_ITEMS_PER_FEED") || 25;

 let bounceLoad = localStorage.getItem("BOUNCE_LOAD") != "false";

 let clearDatabase = "";

 let restoreHandle = "";

 let xDown = null;
 let yDown = null;

 // derived state
 $: leftDisabled = ($cursor <= 0) || (screen != Screens.browse);
 $: rightDisabled = ($cursor >= $length - 1) || (screen != Screens.browse);
 $: screen = !$running ? Screens.shutdown : screen;
 $: alertClass = alertClassFromType($alertType);
 $: dummy = isDummyItem($currentItem);

 afterUpdate(() => {
     if (!$currentItem)
	 return;
     let container = document.querySelector("#content_html");
     let baseUrl = $currentItem.url;
     if (!container || dummy)
	 return;
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
     window.scrollTo({top: 0});
     backwardItem();
 }

 function clickRight() {
     window.scrollTo({top: 0});
     forwardItem();
 }

 function browseTouchStart(evt) {
     xDown = evt.touches[0].clientX;
     yDown = evt.touches[0].clientY;
 }

 function browseTouchMove(evt) {
     if ( ! xDown || ! yDown || screen != Screens.browse ) {
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
     shouldUnsubscribe = !dummy;
     screen = Screens.trash;
 }

 function clickRefresh() {
     clearAlert();
     refreshItem();
 }

 function clickConfirmDelete() {
     if (shouldUnsubscribe)
	 unsubscribe($currentItem.feedId);
     else
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
     localStorage.setItem("TRUNCATE_ITEMS_PER_FEED", truncateItemsPerFeed.value);
     localStorage.setItem("BOUNCE_LOAD", bounceLoad);
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

 function clickSaveFeeds(e) {
     e.preventDefault();
     saveFeeds();
 }

 function clickRestoreFeeds(e) {
     e.preventDefault();
     restoreFeeds(restoreHandle);
 }

</script>

<svelte:head>
    <title>Airss Reader({$cursor+1}/{$length})</title>
</svelte:head>

<div id="layout" class="relative min-h-screen flex flex-col lg:max-w-screen-lg lg:mx-auto">
    <div class="sticky top-0 bg-gray-100 p-2 flex">
	<div>
	    <a href="/"><img src="/images/airss_logo.png" class="inline-block h-8"></a>
	    <span class="text-gray-600 align-bottom whitespace-nowrap">{$cursor+1}/{$length}</span>
	</div>
      <div class="flex-grow text-right">
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
			 on:click={clickConfig}>🔧</button>
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
		  on:click={clickSubscribe}>🍼</button>
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
		  disabled={leftDisabled}
		  on:click={clickLeft}>◀</button>
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
		  disabled={rightDisabled}
		  on:click={clickRight}>▶</button>
      </div>
  </div>
  <p class={alertClass} role="alert" on:click={clearAlert}>{@html $alertText}</p>
  <div class="flex-grow"
      on:touchstart|passive={browseTouchStart}
      on:touchmove|passive={browseTouchMove}>
  {#if screen == Screens.browse}
      <div class="bg-white p-2 flow-root w-full overflow-x-hidden">
	  {#if $currentItem}
	      {#if !dummy}
		  {#if $currentItem.imageUrl}
		      <div class="sm:float-right sm:ml-2">
			  <a href={$currentItem.url} target="_blank" rel="noopener noreferrer">
			      <img src={$currentItem.imageUrl} alt="thumbnail" decoding="sync"
			      class="w-auto max-w-full max-w-xs max-h-48 md:max-w-lg md:max-h-64"/>
			  </a>
		      </div>
		  {:else}
		      <div class="float-left mr-2">
			  <a href={$currentItem.url} target="_blank" rel="noopener noreferrer">
			      <img src={UnknownImage} alt="thumbnail" decoding="sync"
			      class="w-16 h-16"/>
			  </a>
		      </div>
		  {/if}
	      {/if}
	      <h4 class="font-bold my-2 text-lg leading-snug w-full sm:text-2xl sm:w-auto">
		  {#if dummy}
		      {$currentItem.title}
		  {:else}
		      <a href={$currentItem.url} target="_blank" rel="noopener noreferrer">
                          {$currentItem.title}</a>
		  {/if}
	      </h4>
	  <h5 class="text-sm leading-snug sm:text-base sm:leading-normal">
	      <span class="whitespace-nowrap text-gray-400">
		  {$currentItem.feedTitle}
	      </span>
	      <span class="whitespace-nowrap text-gray-400">
		  | {$currentItem.datePublished.toLocaleString()}
	      </span>
	  </h5>
	  {/if}
	  <div id="content_html"
	       class="font-serif text-gray-800 leading-snug mb-2 sm:text-lg sm:leading-relaxed">
	      {#if $currentItem}
		  {@html $currentItem.contentHtml}
	      {:else}
		  <h2>No news is bad news</h2>
		  <p>
		      Airss is a web feed reader that runs entirely in your browser. You can subscribe any feeds by clicking the 🍼 button from above and paste the URL, or you can use of one of the following tricks: 
		  </p>
		  <h3>Desktop browser users</h3>
		  <p>
		      Install this bookmarklet <a class="button" href="javascript:location.href='{airssPrefix}?url='+encodeURIComponent(window.location.href)">Subscribe it in Airss</a> <b>by dragging it to your bookmarks</b>. Whenever you encounter something interesting on the web, be it a blog, a news website or whatever, you can click this bookmarklet to subscribe. Chances are they support RSS feeds so you will always stay updated.
		  </p>
		  <h3>Mobile browser users</h3>
		  <p>
		      Android users can install this APP: <a href="https://f-droid.org/en/packages/net.daverix.urlforward/">URL Forwarder</a> (Thank you, David Laurell!) then add a filter as:
		  </p>
		  <pre>{airssPrefix}?url=@url</pre>
		  <p>
		      Then you can share links to the APP and select the menu to subscribe, if it support RSS feeds.
		  </p>
		  <p>
		      iOS Safari users can use the bookmarklet method as mentioned earlier by syncing the bookmarklet from your Mac.
		  </p>
		  <h2>To my fellow bloggers</h2>
		  <p>
		      Please make sure you have your feed <a href="https://www.rssboard.org/rss-autodiscovery">auto-discoverable</a> from your homepage. And if you can, please enable <a href="https://enable-cors.org/">permissive CORS</a> on your blog to reach out to a broader audience. Lastly, if you really like Airss, you can put a link on your homepage:
		  </p>
		  <pre>&lt;a href="{airssPrefix}?subscribe-referrer"
referrerpolicy="no-referrer-when-downgrade"&gt;
Follow me with Airss!
&lt;/a&gt;</pre>
		  <p>
		      So your readers can have an even easier time to follow you.
		  </p>
	      {/if}
	  </div>
	  {#if $currentItem}
	  <div class="flex flex-wrap w-full gap-x-1 justify-center">
	      <button class="button py-1 px-6 inline-block rounded appearance-none font-bold
			     text-lg text-center border-0 text-white bg-pink-600"
		      on:click={clickTrash}>🗑</button>
	      {#if !dummy}
		  <button class="button py-1 px-6 inline-block rounded appearance-none font-bold
			     text-lg text-center border-0 text-white bg-purple-600"
			  on:click={clickRefresh}>📃</button>
		  <a class="button py-1 px-6 inline-block rounded appearance-none font-bold
			     text-lg text-center border-0 text-white bg-purple-600" target="roast"
		     href={roastPrefix + encodeURIComponent($currentItem.url)}>🔥</a>
	      {/if}
	  </div>
	  {/if}
      </div>
  {:else if screen == Screens.shutdown}
      <button class="button py-1 px-6 inline-block rounded appearance-none font-bold
		     text-lg text-center border-0 text-white bg-purple-600"
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
	  <section class="pt-2 border-b
			  lg:flex lg:flex-row lg:flex-wrap lg:gap-x-4 lg:justify-center">
	      <div class="field long">
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
	      <div class="field long">
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
	      <div class="field long">
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
	      <div class="field long">
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
	      <div class="field long">
		  <label for="select-truncate-items-per-feed">
		      Truncate each feed while loading to at most:
		  </label>
		  <select id="select-truncate-items-per-feed" bind:value={truncateItemsPerFeed}>
		      {#each truncateItemsPerFeedChoices as choice}
			  <option selected={choice.value == truncateItemsPerFeedCurrent}
				  value={choice}>{choice.text}</option>
		      {/each}
		  </select>
	      </div>
	      <div class="field long">
		  <label for="input-bounce-load">
		      Load feeds with roastidio.us (<a href="https://github.com/derek-zhou/airss#Proxy">Why</a>):
		  </label>
		  <input id="input-bounce-load" type="checkbox" bind:checked={bounceLoad}>
	      </div>
	  </section>
	  {#if bounceLoad}
	  <section>
	      <div class="field">
		  <button class="button text-button" on:click={clickSaveFeeds}>Save Feeds</button>
		  {#if $postHandle}
		      <label class="code">{$postHandle}</label>
		  {:else}
		      <label class="code">Not Saved</label>
		  {/if}
	      </div>
	  </section>
	  <section>
	      <div class="field">
		  <button class="button text-button" on:click={clickRestoreFeeds}>
		      Restore Feeds</button>
		  <input id="input-restore-handle" type="text" class="short code"
			 bind:value={restoreHandle}>
	      </div>
	  </section>
	  {/if}
	  <section>
	  <div class="field alert alert-danger">
	      <label for="input-clear-database">Danger! Type "clear database" to delete all data</label>
	      <input id="input-clear-database" type="text" bind:value={clearDatabase}>
	  </div>
	  </section>
	  <div class="toolbar">
	      <input class="button" type="submit" value="👌">
	      <input class="button" type="reset" value="👎"
		     on:click={clickCancel}>
	  </div>
      </form>
  {:else if screen == Screens.subscribe}
      <form on:submit|preventDefault={clickSubmitSubscribe}>
	  <section>
	      <div class="field long">
		  <label for="input-feed-url">
		      The URL to the feed or the index page:
		  </label>
		  <input id="input-feed-url" type="text" class="long"
			 bind:value={subscribeUrl}
			 placeholder="enter the url to subscribe">
	      </div>
	  </section>
	  <div class="toolbar">
	      <input class="button" type="submit" value="👌">
	      <input class="button" type="reset" value="👎"
		     on:click={clickCancel}>
	  </div>
      </form>
  {/if}
  </div>
  <div class="text-sm text-gray-700 p-2 flex text-center">
      <div class="w-1/2 text-left">
	  <a href="https://roastidio.us/roast" referrerpolicy="no-referrer-when-downgrade">Roast me at Roastidious</a>
      </div>
      <div class="w-1/2 text-right">
	  <a href="https://github.com/derek-zhou/airss" referrerpolicy="no-referrer-when-downgrade">Fork me on GitHub</a>
      </div>
  </div>
</div>
