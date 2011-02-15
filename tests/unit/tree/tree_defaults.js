/*
 * tree_defaults.js
 */

var tree_defaults = {
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
		};

commonWidgetTests('tree', { defaults: tree_defaults });
