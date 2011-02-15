/*!
 * jQuery UI Tree
 *
 * Copyright (c) 2008-2011 sompylasar <babak.john@gmail.com> ; http://maninblack.info/
 * Licensed under the MIT (MIT-LICENSE.txt)
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
/**
 * jQuery UI Tree
 *
 * Depends:
 *	jquery.ui.core.js
 *  jquery.ui.widget.js
 *  jquery.ui.tree.css
 */
;(function($) {
	// TODO: multitree safe code (check belongsTo in every public function)
	// TODO: nested tree safe code (check belongsTo in functions that call .parents())
	
	var self; //< override window.self to catch errors where 'var self = this' was forgotten.
	
	var uiTreeClasses = {
		base: 'ui-tree',
		header: 'ui-tree-header',
		rootList: 'ui-tree-root',
		node: 'ui-tree-node',
		nodeHeader: 'ui-tree-node-header',
		nodeText: 'ui-tree-node-text',
		nodeChildrenList: 'ui-tree-node-children',
		nodeSelected: 'ui-tree-node-selected',
		nodeDisabled: 'ui-tree-node-disabled',
		nodeCollapsed: 'ui-tree-node-collapsed',
		nodeEmpty: 'ui-tree-node-empty',
		nodeHidden: 'ui-tree-node-hidden',
		nodeLoading: 'ui-tree-node-loading',
		nodeError: 'ui-tree-node-error',
		nodeFirstVisible: 'ui-tree-node-first-visible',
		nodeLastVisible: 'ui-tree-node-last-visible'
	};
 
	// Note: below are private functions that were pulled out to avoid recreating them for each instance of the widget
	
	var getHeader = function (node) {
		return $('> div:eq(0)', node);
	};
	var getHeaderAndNode = function (node) {
	    return getHeader(node).add(node);
	};
	var getAnchor = function (node) {
		return getHeader(node).children('a:eq(0)');
	};
	var getChildren = function (node) {
		return $('ul:eq(0)', node).children('li.'+uiTreeClasses.node);
	};
	var countChildren = function (node) {
		return getChildren(node).length;
	};
	var getDepth = function (node, tree) {
		node = $(node).get(0);
		tree = $(tree).get(0);
		if (!node || !tree) return -1;
		
		if (node === tree)
			return 0;
		
		var found_root = false;
		var depth = 1;
		while (node.parentNode && node.parentNode.tagName) {
			if (node.parentNode == tree) found_root = true;
			if (node.parentNode.tagName.toUpperCase() == 'LI')
				++depth;
			node = node.parentNode;
		}
		
		return (found_root ? depth : -1);
	};
	var belongsTo = function (node, tree) {
		var depth = getDepth(node, tree);
		return (depth > 0);
	};
	
	var logError = function (error) {
		if (typeof console != 'undefined') {
			if (typeof console.error == 'function') console.error('ui-tree error: ' + (error ? (error.message || error || 'unknown') : 'unknown'));
			else if (typeof console.log == 'function') console.log('ui-tree error: ' + (error ? (error.message || error || 'unknown') : 'unknown'));
			if (typeof console.trace == 'function') console.trace();
		}
	};
	
	
	/**
	 * emptyTitle 
	 *
	 * Tooltip ('title' attribute) text that renders to NO TOOLTIP.
	 *
	 * Chrome: 'title' is empty or only spaces or undefined - display parent tooltip.
	 * Opera: 'title' is empty or undefined - display parent tooltip; only spaces - if inside anchor with href, display no tooltip, otherwise parent tooltip.
	 * Mozilla: 'title' is empty or undefined - display parent tooltip; only spaces - display no tooltip.
	 * IE: 'title' is empty - display no tooltip; undefined - display parent tooltip; only spaces - display spaces.
	 * Displaying a parent tooltip is to be avoided. Parent tooltip should be displayed only over parent item itself.
	 */
	var emptyTitle = ($.browser.mozilla ? ' ' : ($.browser.opera ? '  ' : (undefined)));
	
	
	var createNodeEventArgs = function(widget, node) {
		return {
			options: widget.options,
			node: $(node),
			eventArgs: true
		};
	};
	var createNodeLoadEventArgs = function (widget, node, ajaxOptions, httpRequest) {
		return $.extend(createNodeEventArgs(widget, node), {
			ajaxOptions: ajaxOptions,
			httpRequest: httpRequest,
			eventArgs: true
		});
	};
	var createNodeBeforeLoadEventArgs = function(widget, node, ajaxOptions) {
		return createNodeLoadEventArgs(widget, node, ajaxOptions, null);
	};
	var createNodeLoadErrorEventArgs = function(widget, node, ajaxOptions, httpRequest, errorText, exception) {
		return $.extend(createNodeLoadEventArgs(widget, node, ajaxOptions, httpRequest), {
			errorText: errorText,
			exception: exception,
			eventArgs: true
		});
	};
	var createNodeBeforeInsertEventArgs = function (widget, node_context, how) {
		var children_count = (node_context.children ? node_context.children.length || 0 : 0);
		var kind, reference_el;
		$.each(how, function (key, value) { kind = key; reference_el = value; return false; });
		return {
			options: widget.options,
			nodeContext: node_context,
			childrenCount: children_count,
			isLeaf: (children_count <= 0),
			kind: kind,
			referenceElement: reference_el,
			eventArgs: true
		};
	};
	
	var nodeAttr = function (widget, node, attrName, attrValue) {
		var $node = $(node);
		return $node.attr(widget.options.nodeAttributePrefix + attrName, attrValue);
	};
	var nodeAttrRemove = function (widget, node, attrName) {
		var $node = $(node);
		return $node.removeAttr(widget.options.nodeAttributePrefix + attrName);
	};
	var attrIsTrue = function (attrName, attrValue) {
		attrValue = $.trim('' + attrValue);
		return (attrValue == attrName || attrValue == 'true');
	};
	var nodeAttrIsTrue = function (widget, node, attrName) {
		var attrValue = nodeAttr(widget, node, attrName);
		return attrIsTrue(attrName, attrValue);
	};
	var nodeAttrSetTrue = function (widget, node, attrName) {
		return nodeAttr(widget, node, attrName, attrName);
	};
	var nodeAttrSetFalse = function (widget, node, attrName) {
		return nodeAttr(widget, node, attrName, '');
	};
	
	var updateTitle = function (widget, nodes) {
		var self = widget, o = widget.options;
		
		$(nodes).each(function () {
			var $node = $(this);
			var $anchor = getAnchor($node);
			var $span = $anchor.find('span').eq(0);
			
			$anchor.attr('rel', nodeAttr(self, $node, 'rel') || '');
			
			var title = (nodeAttr(self, $node, 'title') || emptyTitle)
				, spanTitle
				, spanText = $span.text().replace('\"','&quot;')
				, errorText = (nodeAttr(self, $node, 'error') || '?')
				, t;
			
			if ( $node.hasClass(uiTreeClasses.nodeDisabled) ) {
				var disabledTitle = nodeAttr(self, $node, 'disabledTitle');
				
				t = emptyTitle;
				(t == undefined ? $anchor.removeAttr('title') : $anchor.attr('title', t));
				
				spanTitle = (disabledTitle === false ? emptyTitle : typeof disabledTitle == 'string' ? disabledTitle : title);
			}
			else {
				t = ($node.hasClass(uiTreeClasses.nodeEmpty) 
						? emptyTitle 
						: ($node.hasClass(uiTreeClasses.nodeLoading)
							? o.loadingTitle
							: ($node.hasClass(uiTreeClasses.nodeCollapsed) 
								? o.expandTitle 
								: o.collapseTitle))) || emptyTitle;
				(t == undefined ? $anchor.removeAttr('title') : $anchor.attr('title', t));
				
				spanTitle = title;
			}
			
			t = ($node.hasClass(uiTreeClasses.nodeError)  &&  o.errorTitleTemplate
					? $.trim(o.errorTitleTemplate.replace(/#\{title\}/g, spanTitle).replace(/#\{error\}/g, errorText))
					: spanTitle) || emptyTitle;
			//(t == undefined ? $span.attr('title', spanText) : $span.attr('title', t));
			(t == undefined ? $span.removeAttr('title') : $span.attr('title', t));
		});
	};
	
	// forward declarations:
	var startLoadChildNodes /* function (widget, nodes [, onSuccess[, onError [, originalEvent]]]) */, 
		cancelLoadChildNodes /* function (widget, nodes[, originalEvent]) */;
	
	var expandRecursive = function (widget, nodes, expandDepth, originalEvent) {
		var self = widget, o = widget.options;
		
		$(nodes).each( function () {
			var $node = $(this);
			
			if (getDepth($node, self.element) >= expandDepth) return;
			
			if ($node.hasClass(uiTreeClasses.nodeLoading) /*|| $node.hasClass(uiTreeClasses.nodeDisabled)*/)
				return;
			
			var collapsed = nodeAttrIsTrue(self, $node, 'collapsed'),
			    notify = ( $node.hasClass(uiTreeClasses.nodeCollapsed) ),
			    remote = nodeAttrIsTrue(self, $node, 'remote'),
			    usecache = nodeAttrIsTrue(self, $node, 'cache'),
			    hascached = nodeAttrIsTrue(self, $node, 'hascached'),
			    finished = function () {
			        getHeaderAndNode($node)
			            .removeClass(uiTreeClasses.nodeLoading);
			        updateTitle(self, $node);
			    },
			    performExpand = function (success) {
			        finished();
			        
			        if (notify && false === self._trigger('node-before-expand', originalEvent, createNodeEventArgs(self, $node)))
				        return;
				    
				    nodeAttrSetFalse(self, $node, 'collapsed');
				    getHeaderAndNode($node)
					    .removeClass(uiTreeClasses.nodeCollapsed);
				    updateTitle(self, $node);
    				
				    var $children = getChildren($node);
    				
				    if ($children.length <= 0)
					    getHeaderAndNode($node).addClass(uiTreeClasses.nodeEmpty);
    				
				    if (notify)
					    self._trigger('node-expanded', originalEvent, createNodeEventArgs(self, $node));
    				
				    expandRecursive(self, $children, expandDepth, originalEvent);
			    };
			
			if (collapsed && remote && !hascached) {
				getHeaderAndNode($node)
				    .addClass(o.nodeLoadingClass);
			    updateTitle(self, $node);
			    
			    startLoadChildNodes(self, $node, performExpand, finished, originalEvent);
			}
			else {
				getHeaderAndNode($node)
				    .addClass(o.nodeLoadingClass);
			    updateTitle(self, $node);
			
				performExpand();
			}
		});
	};
	
	var handleNodeLoadStart = function (widget, $node, ajaxOptions, httpRequest, originalEvent) {
		var self = widget/*, o = widget.options*/;
		
		// Note: node-before-load event (cancellable) is triggered in startLoadChildNodes
		
		nodeAttrRemove(self, $node, 'error');				
		getHeaderAndNode($node)
			.removeClass(uiTreeClasses.nodeError)
			.addClass(uiTreeClasses.nodeLoading);
		updateTitle(self, $node);
		
		var nodeRequestInfo = { 
			$node: $node, 
			ajaxOptions: ajaxOptions, 
			httpRequest: httpRequest, 
			aborted: false 
		};
		self._nodesLoading.push(nodeRequestInfo);
		
		self._trigger('node-load-started', originalEvent, createNodeEventArgs(self, $node));
	};
	var handleNodeLoadSuccess = function (widget, $node, ajaxOptions, httpRequest, originalEvent) {
		var self = widget, o = widget.options;
		
		getHeaderAndNode($node).removeClass(uiTreeClasses.nodeLoading);
		updateTitle(self, $node);
		
		self._trigger('node-load-success', originalEvent, createNodeLoadEventArgs(self, $node, ajaxOptions, httpRequest));
		self._trigger('node-load-complete', originalEvent, $.extend(createNodeLoadEventArgs(self, $node, ajaxOptions, httpRequest), { success: true }));
	};
	var handleNodeLoadError = function (widget, $node, ajaxOptions, httpRequest, status, exception, originalEvent) {
		var self = widget, o = widget.options;
		
		status = status || 'error';
		var errorText = o.errorTextTemplate
			.replace(/#\{status\}/, status)
			.replace(/#\{exception\}/, '' + (exception ? (exception.message || exception || '') : ''))
			.replace(/#\{url\}/, ajaxOptions && ajaxOptions.url ? ajaxOptions.url : o.errorTextUndefinedUrl)
			.replace(/\"/g, '&quot;');
		
		getHeaderAndNode($node).removeClass(uiTreeClasses.nodeLoading);
		
		self.collapseNode($node, originalEvent);
		
		nodeAttr(self, $node, 'error', errorText);
		getHeaderAndNode($node).addClass(uiTreeClasses.nodeError);
		updateTitle(self, $node);
		
		self._trigger('node-load-error', originalEvent, createNodeLoadErrorEventArgs(self, $node, ajaxOptions, httpRequest, status, exception));
		self._trigger('node-load-complete', originalEvent, $.extend(createNodeLoadErrorEventArgs(self, $node, ajaxOptions, httpRequest, status, exception), { success: false }));
	};
	cancelLoadChildNodes = function (widget, nodes, originalEvent) {
		var self = widget/*, o = widget.options*/;
		
		$(nodes).each(function () {
			var $node = $(this);
			
			var aborted_now = false, aborted_ajax = false;
			$.each(self._nodesLoading, function (i, nodeRequestInfo) {
				if (nodeRequestInfo.aborted) return;
				
				if (nodeRequestInfo.$node[0] == $node[0]) {
					if (nodeRequestInfo.httpRequest) {
						aborted_ajax = true;
						nodeRequestInfo.httpRequest.abort();
					}
					nodeRequestInfo.aborted = true;
					
					aborted_now = true;
					return false;
				}
			});
			
			if (aborted_now) {
				if (!aborted_ajax) { // not going to notify in startLoadChildNodes.handleError
					handleNodeLoadError(self, $node, null, null, "abort", null, originalEvent);
				}
			}
		});
	};
	
	var extendNodeList /* function (widget, node, nodeList, originalEvent) */; // forward declaration
	var extendNode = function (widget, nodes, originalEvent) {
		var self = widget, o = widget.options;
		
		$(nodes).each(function () {
			var is_new = false;
			
			var $node = $(this);
			var $list = $node.find('ul:eq(0)');
			var $header = getHeader($node);
			var $anchor = getAnchor($node);
			var $span = $anchor.find('span:eq(0)');
			
			var title = nodeAttr(self, $node, 'title');
			if (!$node.hasClass(uiTreeClasses.node)) { // not previously extended node
				is_new = true;
				
				if (!title) {
					var native_title = $anchor.attr('title') || $node.attr('title');
					
					$anchor.removeAttr('title');
					$node.removeAttr('title');
					
					nodeAttr(self, $node, 'title', native_title);
				}
				
				if ($node.hasClass(uiTreeClasses.nodeHidden))
					$node.attr('hidden', 'hidden');
				
				$node.addClass(uiTreeClasses.node);
			}
			
			if (!$list.length) {
				$list = $('<ul/>').appendTo($node);
			}
			
			var remote = (attrIsTrue('remote', $node.attr('remote')) || nodeAttrIsTrue(self, $node, 'remote'));
			var collapsed = (attrIsTrue('collapsed', $node.attr('collapsed')) || nodeAttrIsTrue(self, $node, 'collapsed'));
			var disabled = (attrIsTrue('disabled', $node.attr('disabled')) || nodeAttrIsTrue(self, $node, 'disabled'));
			var hidden = (attrIsTrue('hidden', $node.attr('hidden')) || nodeAttrIsTrue(self, $node, 'hidden'));
			var selected = (attrIsTrue('selected', $node.attr('selected')) || nodeAttrIsTrue(self, $node, 'selected'));
			var usecache = (attrIsTrue('cache', $node.attr('cache')) || nodeAttrIsTrue(self, $node, 'cache'));
			var hascached = (attrIsTrue('hascached', $node.attr('hascached')) || nodeAttrIsTrue(self, $node, 'hascached'));
			$node.removeAttr('remote');
			$node.removeAttr('collapsed');
			$node.removeAttr('disabled');
			$node.removeAttr('hidden');
			$node.removeAttr('selected');
			if (remote) nodeAttrSetTrue(self, $node, 'remote'); else nodeAttrRemove(self, $node, 'remote');
			if (usecache) nodeAttrSetTrue(self, $node, 'cache'); else nodeAttrRemove(self, $node, 'cache');
			if (hascached) nodeAttrSetTrue(self, $node, 'hascached'); else nodeAttrRemove(self, $node, 'hascached');
			if (collapsed) nodeAttrSetTrue(self, $node, 'collapsed'); else nodeAttrRemove(self, $node, 'collapsed');
			if (disabled) nodeAttrSetTrue(self, $node, 'disabled'); else nodeAttrRemove(self, $node, 'disabled');
			if (hidden) nodeAttrSetTrue(self, $node, 'hidden'); else nodeAttrRemove(self, $node, 'hidden');
			if (selected && !disabled && !hidden) nodeAttrSetTrue(self, $node, 'selected'); else nodeAttrRemove(self, $node, 'selected');
			
			$header.addClass(uiTreeClasses.nodeHeader);
			$span.addClass(uiTreeClasses.nodeText).addClass('ui-state-default');
				//.disableSelection();
			
			$header.unbind('.ui-tree').bind('click' + '.ui-tree', function (event) {
				if (event.target == $anchor[0]) {
					self.toggleNode($node, event);
				}
				else if (event.target == $span[0]) {
					var ret = self._trigger('node-click', event, createNodeEventArgs(self, $node));
					self.selectNode($node, (o.selectMultiple && !!event.ctrlKey), event);
					if (ret !== false && self.getSelectedNodes().length <= 1 && !event.ctrlKey) {
						return;
					}
				}
				return false;
			});
			$anchor.unbind('.ui-tree').bind('click' + '.ui-tree', function (event) {
			}).bind('mouseover' + '.ui-tree', function (event) {
				$span.addClass('ui-state-hover');
			}).bind('mouseout' + '.ui-tree', function (event) {
				$span.removeClass('ui-state-hover');
			});
			
			extendNodeList(self, $node, $list, originalEvent);
			
			if (nodeAttr(self, $node, 'error'))
				getHeaderAndNode($node).addClass(uiTreeClasses.nodeError);
				
			updateTitle(self, $node);
			
			if (is_new) {
				$node.css({ 'display': '' });
				self._trigger('node-inserted', originalEvent, createNodeEventArgs(self, $node));
			}
			
			if (collapsed || (remote && !hascached) || disabled || hidden)
				self.collapseNode($node, originalEvent);
			else 
				self.expandNode($node, originalEvent);
			
			if (hidden) 
				self.hideNode($node, originalEvent);
			else 
				self.showNode($node, originalEvent);
			
			if (disabled) 
				self.disableNode($node, originalEvent);
			else {
				self.enableNode($node, originalEvent);
				if (selected) self.selectNode($node, o.selectMultiple, originalEvent);
			}
		});
	};
	extendNodeList = function (widget, node, nodeList, originalEvent) {
		var self = widget/*, o = widget.options*/;
		
		var $node = $(node), 
			$list = (nodeList ? $(nodeList).eq(0) : $node.find('ul:eq(0)'));
		$list.children().not('li:parent').remove(); // remove empty nodes (ui.tree node should always contain a header)
		var $children = $list.children();
		
		
		$list.addClass(uiTreeClasses.nodeChildrenList);
		if ($children.length > 0) {
			extendNode(self, $children, originalEvent);
			
			getHeaderAndNode($node).removeClass(uiTreeClasses.nodeEmpty);
			
			var $visible = $children.filter('.'+uiTreeClasses.node+':visible:not(.'+uiTreeClasses.nodeHidden+')');
			var $first_visible = $visible.filter(':first');
			var $last_visible = $visible.filter(':last');
			
			getHeaderAndNode($first_visible).addClass(uiTreeClasses.nodeFirstVisible);
			getHeaderAndNode($last_visible).addClass(uiTreeClasses.nodeLastVisible);
		}
		else {
			if (!nodeAttrIsTrue(self, $node, 'remote')) {
				getHeaderAndNode($node).addClass(uiTreeClasses.nodeEmpty);
			}
		}
		
		updateTitle(self, $node);
	};
	var getNodeHtmlId = function (widget, id) {
		if (typeof id != 'string' || !id) return;
		
		var self = widget, o = widget.options,
			nodeId;
		
		if (typeof o.nodeIdTemplate == 'string')
			nodeId = o.nodeIdTemplate.replace(/#\{treeid\}/, self.treeid).replace(/#\{id\}/, id);
		else if ($.isFunction(o.nodeIdTemplate))
			nodeId = o.nodeIdTemplate(id);
		else
			nodeId = uiTreeClasses.node + '_' + id;
		
		return nodeId;
	};
	var getNodeHeaderHtmlId = function (widget, id) {
		if (typeof id != 'string') return;
		
		var self = widget, o = widget.options;
		
		return (typeof o.nodeHeaderIdTemplate == 'string' 
					? o.nodeHeaderIdTemplate.replace(/#\{treeid\}/, self.treeid).replace(/#\{id\}/, id) 
					: ($.isFunction(o.nodeHeaderIdTemplate) ? o.nodeHeaderIdTemplate(id) : uiTreeClasses.nodeHeader + '_' + id));
	};
	var createNode = function (widget, id, text, attrs, data) {
		var self = widget, o = widget.options,
			node = document.createElement('LI'),
			$node = $(node),
			header = document.createElement('DIV'),
			header_anchor = document.createElement('A'),
			header_span = document.createElement('SPAN'),
			list = document.createElement('UL'),
			node_id = getNodeHtmlId(self, id), 
			node_header_id = getNodeHeaderHtmlId(self, id);
		
		if (node_id) {
			nodeAttr(self, node, 'id', id);
			nodeAttr(self, node, 'htmlid', node_id);
			node.setAttribute('id', node_id);
		}
		if (node_header_id) {
			header.setAttribute('id', node_header_id);
		}
		text = '' + ($.isFunction(text) ? text.apply(null, [ id, attrs ]) : text);
		nodeAttr(self, node, 'text', text);
		
		attrs = $.extend({}, o.attrs, attrs);
		if (attrs) {
			$.each(attrs, function (attrName, attrValue) {
				if (!attrName || typeof attrName != 'string') return;
				
				if (attrValue != null) nodeAttr(self, node, attrName, attrValue);
			});
		}
		
		var href = nodeAttr(self, node, 'href'),
			rel = nodeAttr(self, node, 'rel'),
			target = nodeAttr(self, node, 'target');
		if (typeof href != 'undefined') {
			header_anchor.setAttribute('href', href);
		}
		if (typeof rel != 'undefined') {
			header_anchor.setAttribute('rel', rel);
		}
		if (typeof target != 'undefined') {
			header_anchor.setAttribute('target', target);
		}
		
		header_span.innerHTML = text;
		header_anchor.appendChild(header_span);			
		header.appendChild(header_anchor);			
		node.appendChild(header);
		node.appendChild(list);
		
		$node.css({ 'display': 'none' }); //< avoid FOUC
			
		$node.data('ui-tree-node-data', data); //< store arbitary data
		
		return (node);
	};
	
	var convertDataToJSON = function (data, dataType) {
		var result;
		switch (dataType) {
			case "json": 
				result = data;
				break;
			default: 
				result = { error: 'dataType ' + dataType + ' not supported' }; // TODO: process other data types
		} // switch dataType
		return (result || []);
	};
	
	var insertNode = function (widget, node_context, how, originalEvent) {
		if (node_context) {
			var self = widget/*, o = widget.options*/;
			
			if (false === self._trigger('node-before-insert', originalEvent, createNodeBeforeInsertEventArgs(self, node_context, how))) {
				return;
			}
			
			var node_id = getNodeHtmlId(self, node_context.id);
			if (node_id) {
				self.removeNode( $('#' + node_id) );
			}
			
			var node_el = createNode(self, node_context.id, node_context.text, node_context.attrs, node_context.data);
			if (node_el && how) {
				if (how.before) $(how.before).before(node_el);
				else if (how.after) $(how.after).after(node_el);
				else if (how.append) $(how.append).children('ul').eq(0).append(node_el);
				else if (how.prepend) $(how.prepend).children('ul').eq(0).prepend(node_el);
			}
			
			// Note: node-inserted is triggered in extendNode (via extendNodeList)
			
			return node_el;
		}
	};
	var insertRecursive = function (widget, node_contexts, how, originalEvent, _dontExtend) {
		node_contexts = $.makeArray(node_contexts);
		if (!node_contexts) return;
		
		var self = widget/*, o = widget.options*/;
		
		$.each(node_contexts, function (i, node_context) {
			var node_el = insertNode(self, node_context, how, originalEvent);
			if (node_el && node_context.children) 
				insertRecursive(self, node_context.children, { append: node_el }, originalEvent, true);
			if (!_dontExtend) {
				extendNodeList(self, $(node_el).parents('li:eq(0)'), $(node_el).parents('ul:eq(0)'), originalEvent);
			}
		});
	};
	
	startLoadChildNodes = function (widget, nodes, onSuccess, onError, originalEvent) {
		var self = widget, o = widget.options;
		
		$(nodes).each( function () {
			var $node = $(this);
			
			var request = $.extend({}, o.ajaxRequestParams);
			$.each(request, function (key, template) {
				var value = template;
				$.each([ 'id', 'text', 'title' ], function (i, k) {
					var re = new RegExp('#\\{'+k+'\\}', 'g'), 
						v = nodeAttr(self, $node, k);
					value = value.replace(re, v || '');
				});
				request[key] = value;
			});
				
			var data = (typeof o.ajaxOptions.data == 'string' ? o.ajaxOptions.data + '&' + $.param(request) : $.extend(o.ajaxOptions.data || {}, request));
			var s = $.extend({}, o.ajaxOptions, {
				data: data,
				dataType: o.ajaxOptions.dataType || 'json'
				//,dataFilter: function (d) {  return (d && typeof d == 'string' ? d.replace(/\r+/g,' ').replace(/\n+/g,' ') : '');  }
			});
			
			if (false === self._trigger('node-before-load', originalEvent, createNodeBeforeLoadEventArgs(self, $node, s))) {
			    if ($.isFunction(onError)) onError.apply(self, [ null, 'cancel', null ]);
				return;
			}
			
			cancelLoadChildNodes(self, $node, originalEvent);
			
			var handleError = function (xhr, status, exception) {
				handleNodeLoadError(self, $node, s, xhr, status, exception, originalEvent);
				if ($.isFunction(onError)) onError.apply(self, [ xhr, status, exception ]);
			};
			var httpRequest = null;
			
			s.error = handleError;
			
			s.success = function (data, status) {
				//alert('success');
				
				var debugAjax_timeout = null;
				var handleSuccess = function () {
					if (debugAjax_timeout) clearTimeout(debugAjax_timeout);
					
					var newnodes = convertDataToJSON(data, s.dataType);
					
					if ($.isArray(newnodes)) {
						self.setChildNodes($node, newnodes, false, originalEvent, { ajaxOptions: s, httpRequest: httpRequest });
						
						getHeaderAndNode($node).removeClass(uiTreeClasses.nodeLoading);
						updateTitle(self, $node);
					
						if ($.isFunction(onSuccess)) onSuccess.apply(self, [ $node ]);
					}
					else {
						handleNodeLoadError(self, $node, s, httpRequest, newnodes.error, null, originalEvent);
					}
				};
				
				if (!isNaN(o.debugAjax)) debugAjax_timeout = setTimeout(handleSuccess, o.debugAjax);
				else handleSuccess();
			};
			
			s.beforeSend = function (xhr) {
				httpRequest = xhr;
				handleNodeLoadStart(self, $node, s, xhr, originalEvent);
			};
			
			try {
				$.ajax( s );
			} 
			catch (e) {
				handleError(null, "error", e);
			}
		});
	};
	
	var getPrevVisibleNode = function (widget, node) {
		var o = widget.options, $node = $(node).eq(0);
		var $prev = $node.prev('.'+uiTreeClasses.node+':visible').not('.'+uiTreeClasses.nodeHidden);
		var $prev_parent = $node.parents('.'+uiTreeClasses.node).filter('.'+uiTreeClasses.node+':visible').not('.'+uiTreeClasses.nodeHidden).eq(0);
		return ($prev.length ? $prev : $prev_parent);
	};
	var getNextVisibleNode = function (widget, node) {
		var o = widget.options, $node = $(node).eq(0);
		var $next = $node.next('.'+uiTreeClasses.node+':visible').not('.'+uiTreeClasses.nodeHidden);
		var $next_child = getChildren($node).filter('.'+uiTreeClasses.node+':visible').not('.'+uiTreeClasses.nodeHidden).eq(0);
		return ($next_child.length ? $next_child : $next);
	};

	var uitree_instance_counter = 0;
	
	$.widget("ui.tree", {
		
		widgetEventPrefix: "ui-tree-",
		
		options: {
			// basic setup
			disabled: false,
			selectMultiple: false,
			recursiveExpandMaxDepth: 5,
			nodeAttributePrefix: 'node:',

			// Ajax
			ajaxOptions: {},
			ajaxRequestParams: { id: '#{id}' },
			nodeIdTemplate: '#{treeid}-node-#{id}',
			nodeHeaderIdTemplate: '#{treeid}-node-#{id}-header',

			// animations
			// TODO: animations options

			// lang
			loadingTitle: 'Loading...',
			expandTitle: 'Expand this node',
			collapseTitle: 'Collapse this node',
			selectTitle: 'Select this node',
			errorTextUndefinedUrl: 'Local',
			errorTitleTemplate: '#{title} (#{error})',
			errorTextTemplate: '#{exception} (#{url} #{status})',

			// default node attributes
			attrs: {
				title: '',
				disabledTitle: '',
				remote: false,
				cache: false,
				hascached: false
			},
			state: {
				disabled: false,
				collapsed: false,
				selected: false
			},
			
			throwExceptions: false
		},
		
		widget: function () {
			return this.element;
		},
		
		_create: function () {
			++uitree_instance_counter;
			
			var self = this, o = this.options;
			
			self._nodesLoading = [];
			
			self.element.addClass('ui-widget ui-widget-content').addClass(uiTreeClasses.base);
			self.element.children('div').addClass('ui-widget-header').addClass(uiTreeClasses.header)/*.addClass(uiTreeClasses.nodeHeader)*/;
			
			self.treeid = (self.element.attr('id') || (uiTreeClasses.base + '_' + uitree_instance_counter)); // for template expansion

			self.refresh();
			
			// clean up to avoid memory leaks in certain versions of IE 6
			$(window).bind('unload', function() {
				self.$rootList = null;
			});
			
			o.ajaxOptions = o.ajaxOptions || {};
			if (o.ajaxOptions.url) {
				setTimeout(function () {
					startLoadChildNodes(self, self.element);
				}, 10); // to be able to bind to events before they fire
			}
		},
		
		refresh: function () {
			var self = this;
			
			self.$rootList = self.element.find('ul:eq(0)');
			if (self.$rootList.length <= 0) {
				self.$rootList = $(document.createElement('UL'));
				self.element.append(self.$rootList);
			}
			self.$rootList.addClass(uiTreeClasses.rootList);
			
			extendNodeList(self, self.element, self.$rootList);
		},
		
		nodeData: function (node, data) {
			/// <summary>
			/// <para lang="en">Sets or gets node data (using jQuery.fn.data).</para>
			/// <para lang="ru">Устанавливает или считывает произвольные данные, записанные на указанном узле (используя jQuery.fn.data).</para>
			/// </summary>
			/// <param name="node" type="Element">
			/// <para lang="en">Tree node. [required]</para>
			/// <para lang="ru">Узел дерева. [обязательный]</para>
			/// </param>
			/// <param name="data" type="Object" optional="true">
			/// <para lang="en">New data. [optional]</para>
			/// <para lang="ru">Новые данные. [необязательный]</para>
			///	</param>
			/// <returns>
			///	<para lang="en">
			///		<list>
			///		<item><term>jQuery</term><description>If data is defined (typeof data != 'undefined'), makes chaining available.</description></item>
			///		<item><term>Object or null</term><description>Requested data if previously set; otherwise null.</description></item>
			///     </list>
			///	</para>
			///	<para lang="ru">
			///		<list>
			///		<item><term>jQuery</term><description>Если data определен (не undefined), делает возможным вызов по цепочке.</description></item>
			///		<item><term>Object или null</term><description>Считанные данные, если они были установлены ранее; иначе null.</description></item>
			///     </list>
			///	</para>
			/// </returns>
			
			var self = this;
			
			if (!belongsTo(node, self.element[0])) { 
				// don't set data on nodes from other tree
				return (set ? this : (typeof ret == 'undefined' ? null : ret));
			}
			
			var set = (typeof data != 'undefined'),
				ret = (set 
						? (data === null 
							? $(node).removeData('ui-tree-node-data') 
							: $(node).data('ui-tree-node-data', data)) 
						: $(node).data('ui-tree-node-data'));
			
			return (set ? this : (typeof ret == 'undefined' ? null : ret));
		},
		
		nodeAttr: function (node, attrName, attrValue) {
			/// <summary>
			/// <para lang="en">Sets or gets node attributes.</para>
			/// <para lang="ru">Устанавливает или считывает атрибуты указанного узла.</para>
			/// </summary>
			/// <param name="node" type="Element">
			/// <para lang="en">Tree node. [required]</para>
			/// <para lang="ru">Узел дерева. [обязательный]</para>
			/// </param>
			/// <param name="attrName" type="String">
			/// <para lang="en">Node attribute name, case insensitive [required].
			/// Predefined attributes: (text|rel|href|target|title|disabledTitle|cache|hascached|remote|collapsed|expanded|enabled|disabled|selected|error).</para>
			/// <para lang="ru">Имя атрибута узла, нечувствительно к регистру. [обязательный]
			/// Встроенные атрибуты: (text|rel|href|target|title|disabledTitle|cache|hascached|remote|collapsed|expanded|enabled|disabled|selected|error).</para>
			/// </param>
			/// <param name="attrValue" type="String" optional="true">
			/// <para lang="en">Attribute new value. [optional]</para>
			/// <para lang="ru">Значение, присваиваемое атрибуту. [необязательный]</para>
			///	</param>
			/// <returns>
			///	<para lang="en">
			///		<list>
			///		<item><term>jQuery</term><description>If attrValue is defined (typeof attrValue != 'undefined'), makes chaining available.</description></item>
			///		<item><term>String or Boolean</term><description>Requested attribute value.</description></item>
			///     </list>
			///	</para>
			///	<para lang="ru">
			///		<list>
			///		<item><term>jQuery</term><description>Если attrValue определен (не undefined), делает возможным вызов по цепочке.</description></item>
			///		<item><term>String или Boolean</term><description>Считанное значение атрибута.</description></item>
			///     </list>
			///	</para>
			/// </returns>
			
			var self = this, o = this.options;
			var set = (typeof attrValue != 'undefined'), 
				ret;
				
			if (typeof attrName != 'string') {
				var error = new Error("ui-tree.nodeAttr: 'attrName' argument must be String");
						//("ui-tree.nodeAttr: Параметр attrName должен быть типа String");
				if (this.options.throwExceptions) throw error; else { logError(error); return (set ? self.element : ret); }
			}
			
			attrName = $.trim('' + attrName).toLowerCase();
			
			if (!belongsTo(node, self.element[0])) { 
				// don't set attributes on nodes from other tree
				return (set ? this : (typeof ret == 'undefined' ? null : ret));
			}
			if (!/^(id|text|rel|href|target|title|disabledTitle|cache|hascached|remote|collapsed|expanded|enabled|disabled|selected|error)$/.test(attrName)) {
				// not predefined attributes
				ret = nodeAttr(self, node, attrName, attrValue);
				return (set ? this : (typeof ret == 'undefined' ? null : ret));
			}
			
			if (/^(cache|hascached|remote|collapsed|expanded|enabled|disabled|selected)$/.test(attrName)) { 
				// boolean attributes
				if (typeof attrValue == 'string') {
					attrValue = $.trim('' + attrValue).toLowerCase();
					
					if (attrValue == attrName || attrValue == 'true') attrValue = true;
					else if (attrValue == '' || attrValue == 'false') attrValue = false;
					else attrValue = undefined;
				}
				else {
					attrValue = !!attrValue;
				}
			}
			else {
				// string attributes
				attrValue = '' + attrValue;
			}
			
			switch (attrName) {
				case 'collapsed': {
					ret = !!($(node).hasClass(uiTreeClasses.nodeCollapsed));
					if (set) {
						if (attrValue)
							self.collapseNode(node);
						else if (attrValue === false)
							self.expandNode(node);
					}
				} break;
				case 'expanded': {
					ret = !($(node).hasClass(uiTreeClasses.nodeCollapsed));
					if (set) {
						if (attrValue)
							self.expandNode(node);
						else if (attrValue === false)
							self.collapseNode(node);
					}
				} break;
				case 'disabled': {
					ret = !!($(node).hasClass(uiTreeClasses.nodeDisabled));
					if (set) {
						if (attrValue)
							self.disableNode(node);
						else if (attrValue === false)
							self.enableNode(node);
					}
				} break;
				case 'enabled': {
					ret = !($(node).hasClass(uiTreeClasses.nodeDisabled));
					if (set) {
						if (attrValue)
							self.enableNode(node);
						else if (attrValue === false)
							self.disableNode(node);
					}
				} break;
				case 'selected': {
					ret = !!($(node).hasClass(uiTreeClasses.nodeSelected));
					if (set) {
						if (attrValue)
							self.selectNode(node, o.selectMultiple);
						else if (attrValue === false)
							self.deselectNode(node);
					}
				} break;
				case 'cache':
				case 'hascached':
				case 'remote': {
					ret = (set 
							? attrValue 
								? nodeAttrSetTrue(self, node,  attrName) 
								: nodeAttrSetFalse(self, node, attrName)
							: nodeAttrIsTrue(self, node, attrName));
							
					if (set) {
						if (attrName == 'remote' && attrValue) {
							if (!nodeAttrIsTrue(self, node, 'hascached')) {
								nodeAttrRemove(self, node, 'error');
								getHeaderAndNode(node)
									.removeClass(uiTreeClasses.nodeError)
									.removeClass(uiTreeClasses.nodeEmpty)
									.addClass(uiTreeClasses.nodeCollapsed);
							}
						}
					}
				} break;
				case 'id':
					ret = nodeAttr(self, node, attrName, (set ? attrValue : undefined));
					
					if (set) {
						node.attr('id', getNodeHtmlId(self, attrValue));
						getHeader(node).attr('id', getNodeHeaderHtmlId(self, attrValue));
					}
					break;
				case 'text':
					ret = nodeAttr(self, node, attrName, (set ? attrValue : undefined));
					
					if (set) {
						getHeader(node).find('.'+uiTreeClasses.nodeText).html(attrValue);
					}
					break;
				case 'title':
				case 'disabledTitle':
				case 'error':
				case 'rel':
				case 'href':
				case 'target': {
					ret = nodeAttr(self, node, attrName, (set ? attrValue : undefined));
					
					if (set) {
						if (attrName == 'error') {
							if (attrValue)
								$(node).addClass(uiTreeClasses.nodeError);
							else
								$(node).removeClass(uiTreeClasses.nodeError);
						}
						if (attrName == 'href' || attrName == 'rel' || attrName == 'target') {
							var $anchor = getHeader(node).find('a:eq(0)');
							$anchor.attr(attrName, attrValue);
						}
					}
					
					updateTitle(self, node);
				} break;
			} // switch attrName
			
			return (set ? this : (typeof ret == 'undefined' ? null : ret));
		},
		
		nodeContext: function (node, recursive) {
			/// <summary>
			/// <para lang="en">Constructs an object that describes node's current state.</para>
			/// <para lang="ru">Формирует объект, описывающий текущее состояние узла дерева.</para>
			/// </summary>
			/// <param name="node" type="Element">
			/// <para lang="en">Tree node. [required]</para>
			/// <para lang="ru">Узел дерева. [обязательный]</para>
			/// </param>
			/// <param name="recursive" type="Boolean" optional="true" default="false">
			/// <para lang="en">Should children contexts be collected into 'children' array? [optional, default = false]</para>
			/// <para lang="ru">Флаг, указывающий, собирать в массив children информацию о дочерних узлах, или нет. [необязательный, по-умолчанию = false]</para>
			/// </param>
			/// <returns type="Object">
			/// <para lang="en">Object containing fields that describe the node (for format description, see method <see cref="setChildNodes" />).
			/// If 'recursive' is not 'true', 'children' will be set to 'null', otherwise the array of child nodes' contexts.</para>
			/// <para lang="ru">Object, содержащий поля описания узла (формат объекта см. в описании метода <see cref="setChildNodes" />).
			/// Если информация о дочерних узлах не собиралась, children == null, иначе - массив описаний узлов.</para>
			/// </returns>
			
			var self = this, o = this.options;
			var $node = $(node).eq(0);
			var context = { 
				id: self.nodeAttr($node, 'id'), 
				text: getHeader($node).find('.'+uiTreeClasses.nodeText).html(), 
				children: (recursive ? [ ] : null), 
				attrs: { 
					rel: getHeader($node).find('a:eq(0)').attr('rel'),  //self.nodeAttr($node, 'rel'), 
					href: getHeader($node).find('a:eq(0)').attr('href'),  //self.nodeAttr($node, 'href'), 
					target: getHeader($node).find('a:eq(0)').attr('target'),  //self.nodeAttr($node, 'target'), 
					title: self.nodeAttr($node, 'title'), 
					disabledTitle: self.nodeAttr($node, 'disabledTitle'),
					remote: self.nodeAttr($node, 'remote'), 
					cache: self.nodeAttr($node, 'cache'), 
					hascached: self.nodeAttr($node, 'hascached'),
					collapsed: self.nodeAttr($node, 'collapsed'), 
					disabled: self.nodeAttr($node, 'disabled'), 
					selected: self.nodeAttr($node, 'selected'),
					loading: $node.hasClass(uiTreeClasses.nodeLoading),
					error: self.nodeAttr($node, 'error')
				},
				data: self.nodeData($node)
			};
			
			if (recursive) {
				getChildren($node).each(function () {
					context.children.push( self.nodeContext(this, recursive) );
				});
			}
			
			return context;
		},
		
		setChildNodes: function (node, children_contexts, add, originalEvent, _from_ajax) {
			/// <summary>
			/// <para lang="en">Creates a collection of nodes and adds/replaces child nodes of the specified node.</para>
			/// <para lang="ru">Создает набор узлов и заменяет/добавляет дочерние узлы к заданному узлу.</para>
			/// </summary>
			/// <param name="node" type="Element" mayBeNull="true">
			///	<para lang="en">Tree node to add children to.
			///		<list>
			///			<item><term>Array or jQuery</term><description>The first element of the collection is used.</description></item>
			///			<item><term>null</term><description>Use the root container.</description></item>
			///     </list>
			///	</para>
			/// <para lang="ru">Узел дерева, к которому добавлять элементы.
			///		<list>
			///			<item><term>Array or jQuery</term><description>Будет использован первый элемент коллекции.</description></item>
			///			<item><term>null</term><description>Использовать корень дерева.</description></item>
			///     </list>
			///	</para>
			/// </param>
			/// <param name="children_contexts" type="Array">
			/// <para lang="en">Array of node contexts.
			///     One node context is an Object with the following fields:
			///     id       (String) - node identifier (unique for this tree; nodes with repeating non-empty identifiers are deleted) [required]
			///     text     (String) - node text (caption) [required]
			///     children (Array)  - child nodes' contexts array [optional]
			///     attrs.collapsed     (Boolean) - "node is collapsed" [optional]
			///     attrs.disabled      (Boolean) - "node is disabled" [optional]
			///     attrs.selected      (Boolean) - "node is selected" [optional]
			///     attrs.rel           (String)  - 'rel' attribute for 'a' tag [optional]
			///     attrs.href          (String)  - 'href' attribute for 'a' tag [optional]
			///     attrs.target        (String)  - 'target' attribute for 'a' tag [optional]
			///     attrs.title         (String)  - node hint (tooltip) [optional]
			///     attrs.disabledTitle (String)  - node hint (tooltip) for "node is disabled" state [optional]
			///     attrs.remote        (Boolean) - "child nodes are downloaded from server" [optional]
			///     attrs.cache         (Boolean) - "cache downloaded nodes" (e.g. the nodes should be downloaded once) [optional]
			///     attrs.hascached     (Boolean) - "nodes are already downloaded" (e.g. children array is filled, but nodes may be refreshed from server later) [optional]
			///     data     (Object) - arbitary data bound to the node [optional]
			///
			///     Attribute values (attrs.*) may be later modified by calling 'nodeAttr'.
			/// </para>
			///	<para lang="ru">
			///     Массив данных о добавляемых элементах.
			///     Один узел представляет собой Object со следующими полями:
			///     id       (String) - идентификатор узла (уникальный в пределях дерева; узлы с повторяющимися непустыми идентификаторами удаляются) [обязательный]
			///     text     (String) - текст (заголовок) узла [обязательный]
			///     children (Array)  - массив дочерних узлов [необязательный]
			///     attrs.collapsed     (Boolean) - флаг "узел свернут" [необязательный]
			///     attrs.disabled      (Boolean) - флаг "узел недоступен" [необязательный]
			///     attrs.selected      (Boolean) - флаг "узел выделен" [необязательный]
			///     attrs.rel           (String)  - атрибут 'rel' тега 'a' узла [необязательный]
			///     attrs.href          (String)  - атрибут 'href' тега 'a' узла [необязательный]
			///     attrs.target        (String)  - атрибут 'target' тега 'a' узла [необязательный]
			///     attrs.title         (String)  - подсказка узла (tooltip) [необязательный]
			///     attrs.disabledTitle (String)  - подсказка узла (tooltip) в состоянии "узел недоступен" [необязательный]
			///     attrs.remote        (Boolean) - флаг "дочерние узлы подгружаются с сервера" [необязательный]
			///     attrs.cache         (Boolean) - флаг "кэшировать (сохранять) подгруженные узлы" (например, если узлы загружаются однократно) [необязательный]
			///     attrs.hascached     (Boolean) - флаг "узлы уже подгружены" (например, если уже заполнен массив children, но может потребоваться перезагрузка дочерних узлов в будущем) [необязательный]
			///     data     (Object) - произвольные данные, прикрепленные к узлу [необязательный]
			///
			///     Значения атрибутов (attrs.*) могут быть изменены вызовом функции 'nodeAttr'.
			///	</para>
			///	<code>
			///		children_contexts = [ 
			///         { 
			///             id: '', text: '', children: [ ... ], 
			///             attrs: { rel: '', href: '', title: '', disabledTitle: '', 
			///                      remote: true, cache: false, hascached: true,
			///                      collapsed: true, disabled: false, selected: false },
			///             data: nodeModel
			///         }, ... ]
			///	</code>
			/// </param>
			/// <param name="add" type="Boolean" optional="true">
			/// <para lang="en">Add (true) or replace (false) child nodes. [optional]</para>
			///	<para lang="ru">Добавить (true) или заменить (false) дочерние узлы. [необязательный]</para>
			///	</param>
			/// <param name="originalEvent" type="Object" optional="true">
			///	<para lang="en">[optional]</para>
			///	<para lang="ru">[необязательный]</para>
			///	</param>
			/// <param name="_from_ajax" type="Object" optional="true">
			///	<para lang="en">Internal usage only. Contains info for handleNodeLoadStart, handleNodeLoadSuccess. [optional]</para>
			///	<para lang="ru">Для внутреннего использования. Содержит информацию для handleNodeLoadStart, handleNodeLoadSuccess. [необязательный]</para>
			///	</param>
			
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'setChildNodes', args: $.makeArray(arguments) };
			//}
			
			var self = this, o = this.options;
			var $node = (node ? $(node) : null);
			
			var $list;
			if ($node && $node.length > 0) {
				$node = $node.eq(0);
				$list = $node.find('ul:eq(0)');
			}
			else {
				$node = self.element;
				$list = self.$rootList;
			}
			
			if ($node.length <= 0) return;
			
			cancelLoadChildNodes(self, $node, originalEvent);
			
			if (!_from_ajax) // haven't notified in startLoadChildNodes.beforeSend
				handleNodeLoadStart(self, $node, null, null, originalEvent);
			
			if (!$list) {
				$list = document.createElement('UL');
				$node.append($list);
			}
			if (!add) {
				self.removeNode( getChildren($node), originalEvent );
			}
			
			insertRecursive(self, children_contexts, { append: $node }, originalEvent);
			
			nodeAttrSetTrue(self, $node, 'hascached');
			
			handleNodeLoadSuccess(self, $node, 
				(_from_ajax ? _from_ajax.ajaxOptions : null), 
				(_from_ajax ? _from_ajax.httpRequest : null),
				originalEvent);
			
			if (nodeAttrIsTrue(self, $node, 'collapsed')) {
				self.collapseNode($node, originalEvent);
			}
			else {
				//nodeAttrRemove(self, $node, 'collapsed');
				self.expandNode($node, originalEvent);
			}
			
			if (!nodeAttrIsTrue(self, $node, 'cache')) {
				nodeAttrRemove(self, $node, 'hascached'); // remove caching if not going to use it further
			}
		},
		
		insertNode: function (node_contexts, kind, reference_el, originalEvent) {
			var self = this, o = this.options;
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'insertNode', args: $.makeArray(arguments) };
			//}
			
			if (!/^(after|before|append|prepend)$/.test('' + kind)) {
				var error = new Error("ui-tree.insertNode: 'kind' argument must be String and match one of (after|before|append|prepend)");
				if (this.options.throwExceptions) throw error; else { logError(error); return; }
			}
			reference_el = this.getNode(reference_el);
			if (!reference_el || !reference_el.length) {
				var error = new Error("ui-tree.insertNode: 'reference_el' argument must be set and must exist in the DOM");
				if (this.options.throwExceptions) throw error; else { logError(error); return; }
			}
			
			var how = {}; how[kind] = reference_el;
			
			insertRecursive(self, node_contexts, how, originalEvent);
		},
		removeNode: function (nodes, originalEvent) {
			var self = this, o = this.options;
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'removeNode', args: $.makeArray(arguments) };
			//}
			
			$(nodes).each(function () {
				var $node = $(this);
				
				self.deselectNode($node, originalEvent);
				
				$node.remove();
				
				self._trigger('node-removed', originalEvent, createNodeEventArgs(self, $node));
			});
		},
		
		getNode: function (node_or_inner_or_id) {
			if (!node_or_inner_or_id) return $([]);
			if (typeof node_or_inner_or_id == 'string' && node_or_inner_or_id.length) 
				return $('#'+getNodeHtmlId(this, node_or_inner_or_id)).eq(0).closest('li.'+uiTreeClasses.node).eq(0);
			else
				return $(node_or_inner_or_id).eq(0).closest('li.'+uiTreeClasses.node).eq(0);
			// TODO: verify node to be of the same tree (nested trees case?)
		},
		getNodeHeader: function (node) {
			if (!node) return $([]);
			var $node = this.getNode(node).filter('li.'+uiTreeClasses.node).eq(0);
			return getHeader($node);
		},
		getNodeAnchor: function (node) {
			if (!node) return $([]);
			var $node = this.getNode(node).filter('li.'+uiTreeClasses.node).eq(0);
			return getAnchor($node);
		},
		getParentNode: function (node) {
			if (!node) return $([]);
			var $node = this.getNode(node).filter('li.'+uiTreeClasses.node).eq(0);
			return $node.parents('li:eq(0)');
		},
		getChildNodes: function (node) {
			if (!node) return getChildren(this.element);
			var $node = this.getNode(node).filter('li.'+uiTreeClasses.node).eq(0);
			return getChildren($node);
		},
		getSelectedNodes: function (node, include_node) {
			var self = this, $node = (node ? self.getNode(node).filter('li.'+uiTreeClasses.node).eq(0) : self.element);
			var $nodes = $node.find('li.'+uiTreeClasses.node);
			if (include_node) $nodes = $nodes.add($node);
			return $nodes.filter('.'+uiTreeClasses.nodeSelected);
		},
		
		expandNode: function (nodes, relative_depth, originalEvent) {
			var self = this, o = this.options;
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'expandNode', args: $.makeArray(arguments) };
			//}
			
			// Note: node-before-expand event (cancellable) is triggered in expandRecursive
			
			if (typeof relative_depth != 'number') relative_depth = 1;
			if (relative_depth == 0) relative_depth = o.recursiveExpandMaxDepth;

			if (relative_depth > 0) {
				$(nodes).each(function () {
					var $node = $(this);
					expandRecursive(self, $node, (getDepth($node, self.element) + relative_depth), originalEvent);
				});
			}
		},
		collapseNode: function (nodes, originalEvent) {
			var self = this, o = this.options;
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'collapseNode', args: $.makeArray(arguments) };
			//}
			
			$(nodes).each(function () {
				var $node = $(this);
				
				if ($node.hasClass(uiTreeClasses.nodeDisabled))
					return;
				
				cancelLoadChildNodes(self, $node, originalEvent);
				
				var notify = ( !$node.hasClass(uiTreeClasses.nodeCollapsed) );				
				if (notify && false === self._trigger('node-before-collapse', originalEvent, createNodeEventArgs(self, $node)))
					return;
				
				if (!nodeAttrIsTrue(self, $node, 'cache')) {
					nodeAttrSetFalse(self, $node, 'hascached'); // remove hascached flag to force reload child nodes on next expand
				}
				nodeAttrSetTrue(self, $node, 'collapsed');
				
				getHeaderAndNode($node)
					.addClass(uiTreeClasses.nodeCollapsed);
				
				updateTitle(self, $node);
				
				if (notify)
					self._trigger('node-collapsed', originalEvent, createNodeEventArgs(self, $node));
			});
		},
		toggleNode: function (nodes, originalEvent) {
			var self = this, o = this.options;
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'toggleNode', args: $.makeArray(arguments) };
			//}
			
			$(nodes).each( function () {
				var $node = $(this);
				
				if ($node.hasClass(uiTreeClasses.nodeCollapsed))
					self.expandNode($node, null, originalEvent);
				else
					self.collapseNode($node, originalEvent);
			});
		},
		
		selectNode: function (nodes, add, originalEvent) {
			var self = this, o = this.options;
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'selectNode', args: $.makeArray(arguments) };
			//}
			
			var $prev_selected = self.element.find('li.'+uiTreeClasses.node+'.'+uiTreeClasses.nodeSelected);
			var deselected = false;
			
			$(nodes).each(function () {
				var $node = $(this);
				if ($node.hasClass(uiTreeClasses.nodeDisabled)) { // selection of disabled nodes is not allowed
					self.deselectNode($node, originalEvent);
					return;
				}
				
				var notify = ( !$node.hasClass(uiTreeClasses.nodeSelected) );
				var eventArgs = ( notify ? $.extend(createNodeEventArgs(self, $node), { add: add }) : null );
				if (notify && false === self._trigger('node-before-select', originalEvent, eventArgs))
					return;
				
				//add = eventArgs.add; // allow to alter 'add' behavior
				if (!add && !deselected) {
					deselected = true;
					self.deselectNode($prev_selected.filter(function () { return $.inArray(this, $node) < 0; }), originalEvent);
				}
				else if (add && !notify) {
					self.deselectNode($node, originalEvent);
				}
				
				if (!add || notify) {
					getHeader($node).find('span')
						.addClass('ui-state-highlight');
					getHeaderAndNode($node)
						.addClass(uiTreeClasses.nodeSelected);
					updateTitle(self, $node);
				}
				
				if (notify)
					self._trigger('node-selected', originalEvent, eventArgs);
			});
		},
		deselectNode: function (nodes, originalEvent) {
			var self = this, o = this.options;
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'deselectNode', args: $.makeArray(arguments) };
			//}
			
			$(nodes).each(function () {
				var $node = $(this);
				
				var notify = ( $node.hasClass(uiTreeClasses.nodeSelected) );
				if (notify && false === self._trigger('node-before-deselect', originalEvent, createNodeEventArgs(self, $node)))
					return;
				
				getHeader($node).find('span')
					.removeClass('ui-state-highlight');
				getHeaderAndNode($node)
					.removeClass(uiTreeClasses.nodeSelected);
				updateTitle(self, $node);
					
				if (notify)
					self._trigger('node-deselected', originalEvent, createNodeEventArgs(self, $node));
			});
		},
		
		enableNode: function (nodes, originalEvent) {
			var self = this, o = this.options;
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'enableNode', args: $.makeArray(arguments) };
			//}
			
			$(nodes).each( function () {
				var $node = $(this);
				
				var notify = ( $node.hasClass(uiTreeClasses.nodeDisabled) );
				if (notify && false === self._trigger('node-before-enable', originalEvent, createNodeEventArgs(self, $node)))
					return;
				
				getHeader($node).find('span')
					.removeClass('ui-state-disabled');
				getHeaderAndNode($node)
					.removeClass(uiTreeClasses.nodeDisabled);
				updateTitle(self, $node);
				
				if (notify)
					self._trigger('node-enabled', originalEvent, createNodeEventArgs(self, $node));
			});
		},
		disableNode: function (nodes, originalEvent) {
			var self = this, o = this.options;
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'disableNode', args: $.makeArray(arguments) };
			//}
			
			$(nodes).each( function () {
				var $node = $(this);
				
				var notify = ( !$node.hasClass(uiTreeClasses.nodeDisabled) );
				if (notify && false === self._trigger('node-before-disable', originalEvent, createNodeEventArgs(self, $node)))
					return;
				
				getHeader($node).find('span')
					.addClass('ui-state-disabled');
				getHeaderAndNode($node)
					.addClass(uiTreeClasses.nodeDisabled);
				updateTitle(self, $node);

				if (notify)
					self._trigger('node-disabled', originalEvent, createNodeEventArgs(self, $node));
			});
		},
		
		hideNode: function (nodes, originalEvent) {
			var self = this, o = this.options;
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'hideNode', args: $.makeArray(arguments) };
			//}
			
			$(nodes).each( function () {
				var $node = $(this);
				
				var notify = ( !$node.hasClass(uiTreeClasses.nodeHidden) );
				if (notify && false === self._trigger('node-before-hide', originalEvent, createNodeEventArgs(self, $node)))
					return;
				
				getHeader($node).find('span')
					.addClass('ui-state-disabled');
				getHeaderAndNode($node)
					.addClass(uiTreeClasses.nodeHidden);
				updateTitle(self, $node);

				if (notify)
					self._trigger('node-hidden', originalEvent, createNodeEventArgs(self, $node));
			});
		},
		showNode: function (nodes, originalEvent) {
			var self = this, o = this.options;
			//if (originalEvent) {
			//	if (!originalEvent.ui_tree) originalEvent.ui_tree = [];
			//	originalEvent.ui_tree[originalEvent.ui_tree.length] = { method: 'showNode', args: $.makeArray(arguments) };
			//}
			
			$(nodes).each( function () {
				var $node = $(this);
				
				var notify = ( $node.hasClass(uiTreeClasses.nodeHidden) );
				if (notify && false === self._trigger('node-before-show', originalEvent, createNodeEventArgs(self, $node)))
					return;
					
				getHeader($node).find('span')
					.addClass('ui-state-disabled');
				getHeaderAndNode($node)
					.removeClass(uiTreeClasses.nodeHidden);
				updateTitle(self, $node);
				
				if (notify)
					self._trigger('node-shown', originalEvent, createNodeEventArgs(self, $node));
			});
		},
		
		destroy: function() {
			var self = this, o = this.options;
			
			// TODO: full destroy
			
			self.element.unbind('.ui-tree')
				.removeClass(o.containerClass);
			
			$.Widget.prototype.destroy.call( this );
		}
	});

	$.extend($.ui.tree, {
		version: "1.8.9"
	});

})(jQuery);
