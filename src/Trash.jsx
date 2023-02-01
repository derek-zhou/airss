import {deleteItem, unsubscribe, Screens, setScreen,
	unsubscribeDefault} from  './airss_controller.js';

let shouldUnsubscribe;

function clickConfirmDelete(e) {
    if (shouldUnsubscribe.value)
	unsubscribe(item.feedId);
    else
	deleteItem();
    setScreen(Screens.browse);
    e.preventDefault();
}

function clickCancel(e) {
    setScreen(Screens.browse);
    e.preventDefault();
}

export default function Trash() {
    return (
<form onSubmit={clickConfirmDelete}>
  <p>
    Are you sure you want to delete this item?
  </p>
  <div class="field">
    <label for="check-unsubscribe">
      Unsubscribe <span class="focus">{props.item.feedTitle}</span> too
    </label>
    <input type="checkbox" id="check-unsubscribe" ref={shouldUnsubscribe}
	   value={unsubscribeDefault()} />
  </div>
  <div class="toolbar">
    <input class="button" type="submit" value="👌" />
    <input class="button" type="reset" value="👎" onClick={clickCancel} />
  </div>
</form>
    );
}
