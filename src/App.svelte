<script>

 // stores
 import {length, cursor, alertText, alertClass, currentItem, running} from './airss_controller.js';

 import { afterUpdate } from 'svelte';
 
 // functions
 import {forwardItem, backwardItem, deleteItem, subscribe, unsubscribe} from  './airss_controller.js';

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
     {value: 0, text: "0 hour"},
     {value: 1, text: "1 hour"},
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

 let apiKey = localStorage.getItem('AIRTABLE_API_KEY') || "";
 let baseToken = localStorage.getItem('AIRTABLE_BASE_TOKEN') || "";

 let xDown = null;
 let yDown = null;

 // derived state
 $: leftDisabled = ($cursor <= 0) || (screen != Screens.browse);
 $: rightDisabled = ($cursor >= $length - 1) || (screen != Screens.browse);
 $: screen = !$running ? Screens.shutdown : screen;

 // view functions

 afterUpdate(() => {
     let container = document.querySelector("#content_html");
     if (!container)
	 return;
     let baseUrl = $currentItem.url;
     // fix up all img's href
     for (let img of container.querySelectorAll("img").values()) {
	 let href = img.getAttribute("src");
	 let absUrl = new URL(href, baseUrl);
	 img.setAttribute("src", absUrl.toString());
     }
 });

 // view functions

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

 function clickConfig() {
     $alertText = "";
     screen = Screens.config;
 }

 function clickSubscribe() {
     $alertText = "";
     screen = Screens.subscribe;
 }

 function clickTrash() {
     $alertText = "";
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
     // airtable_server
     localStorage.setItem("AIRTABLE_API_KEY", apiKey);
     localStorage.setItem("AIRTABLE_BASE_TOKEN", baseToken);
     // It is very hard to change config at run time, so I just take
     // shortcut to reload
     location.reload();
 }

 function clickCancel() {
     $alertText = "";
     screen = Screens.browse;
 }

</script>

<div id="layout" class="viewport">
  <div class="header">
    <a class="brand-title" href="/">AirSS</a>
    <div class="nav">
	<button class="button"
		on:click={clickConfig}>&#x1f527;</button>
	<button class="button"
		on:click={clickSubscribe}>&#x1f37c;</button>
	<button class="button"
		disabled={leftDisabled}
		on:click={clickLeft}>&#x276e;</button>
	{$cursor+1}/{$length}
	<button class="button"
		disabled={rightDisabled}
		on:click={clickRight}>&#x276f;</button>
    </div>
  </div>
  <p class={$alertClass} role="alert">{$alertText}</p>
  <div class="content">
  {#if screen == Screens.browse}
      <div class="box"
	   on:touchstart={browseTouchStart}
	   on:touchmove={browseTouchMove}>
      {#if $currentItem}
	  <div class={$currentItem.imageUrl ? "thumbnail" : "thumbnail-missing"}>
	      <a href={$currentItem.url} target="item">
		  <img src={$currentItem.imageUrl ? $currentItem.imageUrl : UnknownImage}
		       alt="thumbnail"/></a>
	  </div>
	  <h4 class="title"><a href={$currentItem.url}
			       target="item">{$currentItem.title}</a></h4>
	  <h5 class="tag-line">
	      <span class="site">{$currentItem.feedTitle}</span>
	      <span class="site">
		  | {$currentItem.datePublished.toLocaleString()}
	      </span>
	       {#each $currentItem.tags as tag}
                 <span class="site"> | {tag} </span>
               {/each}
	  </h5>
	  <p id="content_html" class="desc">
	      {@html $currentItem.contentHtml}
	  </p>
	  <div class="toolbar">
	      <button class="button button-danger"
		      on:click={clickTrash}>&#128465;</button>
	      <a class="button" target="roast"
		 href={roastPrefix + encodeURIComponent($currentItem.url)}>&#128293;</a>
	  </div>
      {:else if $length == 0}
	  <h4>
	      No news is bad news. How about
	      <button class="button"
		      on:click={clickSubscribe}>subscribe</button>
	      something?
	  </h4>
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
      <div class="box">
	  <button class="button"
		  on:click={clickReload}>Reload</button>
      </div>
  {:else if screen == Screens.trash}
      <div class="box">
	  <p>
	      Are you sure you want to delete this item?
	  </p>
	  <form on:submit|preventDefault={clickConfirmDelete}>
	      <div class="line">
		  <label for="check-unsubscribe">
		      Unsubscribe <span class="focus">{$currentItem.feedTitle}</span> too
		  </label>
		  <input type="checkbox" id="check-unsubscribe"
			 name="ckeck-unsubscribe"
			 bind:checked={shouldUnsubscribe}>
	      </div>
	      <input class="button" type="submit" value="&#128076;">
	      <input class="button" type="reset" value="&#128078;"
		     on:click={clickCancel}>
	  </form>
      </div>
  {:else if screen == Screens.config}
      <div class="box">
	  <form on:submit|preventDefault={clickSubmitConfig}>
	      <div class="line">
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
	      <div class="line">
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
	      <div class="line">
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
	      <div class="line">
		  <label for="input-api-key">
		      Your Airtable API key:
		  </label>
		  <input type="text" bind:value={apiKey}>
	      </div>
	      <div class="line">
		  <label for="input-base-token">
		      The ID of your Airtable base:
		  </label>
		  <input type="text" bind:value={baseToken}>
	      </div>
	      {#if baseToken}
		  <div class="line">
		      Your Airtable base is
		      <a href="https://airtable.com/{baseToken}">
			  https://airtable.com/{baseToken}
		      </a>
		  </div>
	      {/if}
	      <input class="button" type="submit" value="&#128076;">
	      <input class="button" type="reset" value="&#128078;"
		     on:click={clickCancel}>
	  </form>
      </div>
  {:else if screen == Screens.subscribe}
      <div class="box">
	  <form on:submit|preventDefault={clickSubmitSubscribe}>
	      <div class="line">
		  <label for="input-feed-url">
		      The URL to the feed or the index page:
		  </label>
		  <input id="input-feed-url" type="text"
			 bind:value={subscribeUrl}
			 placeholder="enter the url to subscribe">
	      </div>
	      <input class="button" type="submit" value="&#128076;">
	      <input class="button" type="reset" value="&#128078;"
		     on:click={clickCancel}>
	  </form>
      </div>
  {/if}
  </div>
  <div class="footer">
      <div class="links">
	  <a href="https://roastidio.us/roast">feedback</a>
      </div>
      <div class="copyright">
	  © <a href="https://blog.roastidio.us">roastidio.us</a>, 2021
      </div>
  </div>
</div>
