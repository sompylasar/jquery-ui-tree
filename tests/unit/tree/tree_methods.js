/*
 * tree_methods.js
 */
(function($) {

module("tree: methods");

test("init", function() {
	expect(6);

	$("<div></div>").appendTo('body').tree().remove();
	ok(true, '.tree() called on element');

	$([]).tree().remove();
	ok(true, '.tree() called on empty collection');

	$("<div></div>").tree().remove();
	ok(true, '.tree() called on disconnected DOMElement');

	$("<div></div>").tree().tree("foo").remove();
	ok(true, 'arbitrary method called after init');

	el = $("<div></div>").tree()
	var foo = el.data("foo.tree");
	el.remove();
	ok(true, 'arbitrary option getter after init');

	$("<div></div>").tree().data("foo.tree", "bar").remove();
	ok(true, 'arbitrary option setter after init');
});

test("destroy", function() {
	expect(7);

	$("<div></div>").appendTo('body').tree().tree("destroy").remove();
	ok(true, '.tree("destroy") called on element');

	$([]).tree().tree("destroy").remove();
	ok(true, '.tree("destroy") called on empty collection');

	$("<div></div>").tree().tree("destroy").remove();
	ok(true, '.tree("destroy") called on disconnected DOMElement');

	$("<div></div>").tree().tree("destroy").tree("foo").remove();
	ok(true, 'arbitrary method called after destroy');

	el = $("<div></div>").tree();
	var foo = el.tree("destroy").data("foo.tree");
	el.remove();
	ok(true, 'arbitrary option getter after destroy');

	$("<div></div>").tree().tree("destroy").data("foo.tree", "bar").remove();
	ok(true, 'arbitrary option setter after destroy');
	
	var expected = $('<div></div>').tree(),
		actual = expected.tree('destroy');
	equals(actual, expected, 'destroy is chainable');
});

test("enableNode", function() {
	expect(3);
	var fired = false,
		node = $('#tree-node-1');

	el = $("#tree");
	el.tree({
		state: {
			disabled: true
		}
	}).bind('ui-tree-node-click', function() { fired = true; });
	node.simulate("click", 1, 1);
	equals(fired, false, "ui-tree-node-click not fired");
	el.tree("enableNode", node);
	node.simulate("click", 1, 1);
	equals(fired, true, "ui-tree-node-click fired");
	el.tree("destroy");
	
	var expected = $('<div></div>').tree(),
		actual = expected.tree('enableNode');
	equals(actual, expected, 'enable is chainable');
});

test("disableNode", function() {
	expect(3);
	var fired = false,
		node = $('#tree-node-1');

	el = $("#tree");
	el.tree({
		state: {
			disabled: false
		}
	}).bind('ui-tree-node-click', function() { fired = true; });
	node.simulate("click", 1, 1);
	equals(fired, true, "ui-tree-node-click fired");
	el.tree("disableNode", node);
	fired = false;
	node.simulate("click", 1, 1);
	equals(fired, false, "ui-tree-node-click not fired");
	el.tree("destroy");
	
	var expected = $('<div></div>').tree(),
		actual = expected.tree('disableNode');
	equals(actual, expected, 'disable is chainable');
});

test("nodeData", function() {
	expect(6);
	var node = $('#tree-node-1'),
		data = { test: 'test' };

	el = $("#tree");
	el.tree();
	
	var expected = null,
		actual = el.tree("nodeData", node);
	equals(actual, expected, 'nodeData returned null (get before set)');
	
	var expected = el,
		actual = el.tree("nodeData", node, data);
	equals(actual, expected, 'nodeData is chainable on set');
	
	var expected = data,
		actual = el.tree("nodeData", node);
	equals(actual, expected, 'nodeData returned what was stored');
	
	el.tree("nodeData", node, null);
	var expected = null,
		actual = el.tree("nodeData", node);
	equals(actual, expected, 'nodeData returned null (get after set to null)');
	
	el.tree("nodeData", node, 0);
	var expected = 0,
		actual = el.tree("nodeData", node);
	equals(actual, expected, 'nodeData returned 0 (zero Number)');
	
	el.tree("nodeData", node, false);
	var expected = false,
		actual = el.tree("nodeData", node);
	equals(actual, expected, 'nodeData returned false (Boolean)');
	
	el.tree("destroy");
});

})(jQuery);
