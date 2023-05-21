(function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    new Set();

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    // Needs to be written like this to pass the tree-shake-test
    'WeakMap' in globals ? new WeakMap() : undefined;
    function append(target, node) {
        target.appendChild(node);
    }
    function append_styles(target, style_sheet_id, styles) {
        const append_styles_to = get_root_for_style(target);
        if (!append_styles_to.getElementById(style_sheet_id)) {
            const style = element('style');
            style.id = style_sheet_id;
            style.textContent = styles;
            append_stylesheet(append_styles_to, style);
        }
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
        return style.sheet;
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    new Map();

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const _boolean_attributes = [
        'allowfullscreen',
        'allowpaymentrequest',
        'async',
        'autofocus',
        'autoplay',
        'checked',
        'controls',
        'default',
        'defer',
        'disabled',
        'formnovalidate',
        'hidden',
        'inert',
        'ismap',
        'loop',
        'multiple',
        'muted',
        'nomodule',
        'novalidate',
        'open',
        'playsinline',
        'readonly',
        'required',
        'reversed',
        'selected'
    ];
    /**
     * List of HTML boolean attributes (e.g. `<input disabled>`).
     * Source: https://html.spec.whatwg.org/multipage/indices.html
     */
    new Set([..._boolean_attributes]);
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* Embed.svelte generated by Svelte v3.59.1 */

    function add_css(target) {
    	append_styles(target, "svelte-10fovpp", ".widget-container.svelte-10fovpp{padding:5px;background-color:aquamarine;width:150px;text-align:center;border-radius:15px}p.svelte-10fovpp{color:green;font-family:'Comic Sans MS', cursive;font-size:12px}.small-inprint.svelte-10fovpp{font-size:8px;text-align:right;font-weight:bold}");
    }

    function create_fragment(ctx) {
    	let div;
    	let svg;
    	let defs;
    	let g;
    	let path0;
    	let path1;
    	let path2;
    	let t0;
    	let p;
    	let t1_value = /*customer*/ ctx[0].name + "";
    	let t1;
    	let t2;
    	let br0;
    	let t3;
    	let span0;
    	let br1;
    	let t5;
    	let br2;
    	let t6;
    	let span1;

    	return {
    		c() {
    			div = element("div");
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			t0 = space();
    			p = element("p");
    			t1 = text(t1_value);
    			t2 = text(" Planted");
    			br0 = element("br");
    			t3 = space();
    			span0 = element("span");
    			span0.textContent = `${/*customer*/ ctx[0].trees}`;
    			br1 = element("br");
    			t5 = text("\r\n        Tree(s)");
    			br2 = element("br");
    			t6 = space();
    			span1 = element("span");
    			span1.textContent = "Brought to you by ImpactHero";
    			attr(path0, "d", "M 51.865 1.523 c 2.639 0.961 4.659 2.757 6.26 5.115 c 5.117 -0.776 10.301 0.912 13.976 4.587 c 3.675 3.675 5.364 8.857 4.588 13.975 c 4.168 3.07 6.638 7.929 6.638 13.126 c 0 5.393 -2.644 10.387 -7.091 13.437 c -0.76 2.672 -2.184 5.104 -4.135 7.055 c -3.134 3.134 -7.323 4.754 -11.539 4.754 c -3.088 0 -6.19 -0.869 -8.902 -2.649 l 0.549 -0.836 l -10.447 -1.312 c 0 0 0 0 0 0 l -0.216 0.977 c -0.422 -0.094 -0.843 -0.204 -1.256 -0.329 c -3.807 3.412 -8.875 4.69 -13.641 3.882 c 0.009 -0.082 0.048 -0.316 0.054 -0.379 C 21.64 59.31 16.967 51.451 16.924 45 c -0.041 -6.216 2.696 -12.469 7.394 -16.172 c -0.92 -6.117 1.123 -11.997 4.951 -16.687 c 3.961 -4.852 10.438 -6.889 16.416 -5.562 C 45.933 3.689 48.897 2.544 51.865 1.523");
    			set_style(path0, "stroke", "none");
    			set_style(path0, "stroke-width", "1");
    			set_style(path0, "stroke-dasharray", "none");
    			set_style(path0, "stroke-linecap", "butt");
    			set_style(path0, "stroke-linejoin", "miter");
    			set_style(path0, "stroke-miterlimit", "10");
    			set_style(path0, "fill", "rgb(127,178,65)");
    			set_style(path0, "fill-rule", "nonzero");
    			set_style(path0, "opacity", "1");
    			attr(path0, "transform", " matrix(1 0 0 1 0 0) ");
    			attr(path0, "stroke-linecap", "round");
    			attr(path1, "d", "M 26.702 62.925 C 21.64 59.31 17.809 51.551 17.767 45.1 c -0.041 -6.216 2.718 -12.047 7.415 -15.75 c -0.92 -6.117 0.952 -12.328 5.086 -16.751 c 4.133 -4.423 9.991 -6.482 15.793 -5.591 c 1.564 -2.275 3.552 -4.128 5.804 -5.483 C 49.745 0.537 47.41 0 44.999 0 c -5.197 0 -10.056 2.47 -13.126 6.639 c -5.117 -0.777 -10.3 0.912 -13.975 4.587 s -5.364 8.857 -4.587 13.975 c -4.169 3.07 -6.638 7.929 -6.638 13.126 c 0 5.393 2.644 10.387 7.091 13.437 c 0.759 2.67 2.183 5.103 4.135 7.055 c 2.456 2.456 5.534 3.942 8.749 4.487 C 26.656 63.223 26.696 62.987 26.702 62.925 z");
    			set_style(path1, "stroke", "none");
    			set_style(path1, "stroke-width", "1");
    			set_style(path1, "stroke-dasharray", "none");
    			set_style(path1, "stroke-linecap", "butt");
    			set_style(path1, "stroke-linejoin", "miter");
    			set_style(path1, "stroke-miterlimit", "10");
    			set_style(path1, "fill", "rgb(113,156,64)");
    			set_style(path1, "fill-rule", "nonzero");
    			set_style(path1, "opacity", "1");
    			attr(path1, "transform", " matrix(1 0 0 1 0 0) ");
    			attr(path1, "stroke-linecap", "round");
    			attr(path2, "d", "M 57.523 54.976 l -3.031 -2.947 c -0.387 -0.375 -0.999 -0.378 -1.388 -0.007 l -3.865 3.69 V 40.889 c 0 -0.552 -0.447 -1 -1 -1 h -4.275 c -0.552 0 -1 0.448 -1 1 v 7.186 l -4.745 -4.919 c -0.377 -0.391 -1.063 -0.391 -1.439 0 l -2.52 2.614 c -0.369 0.382 -0.374 0.986 -0.013 1.375 l 6.515 7.007 V 89 c 0 0.553 0.448 1 1 1 h 6.477 c 0.553 0 1 -0.447 1 -1 V 64.29 l 8.276 -7.872 c 0.197 -0.188 0.309 -0.447 0.311 -0.719 C 57.828 55.426 57.718 55.166 57.523 54.976 z");
    			set_style(path2, "stroke", "none");
    			set_style(path2, "stroke-width", "1");
    			set_style(path2, "stroke-dasharray", "none");
    			set_style(path2, "stroke-linecap", "butt");
    			set_style(path2, "stroke-linejoin", "miter");
    			set_style(path2, "stroke-miterlimit", "10");
    			set_style(path2, "fill", "rgb(160,126,99)");
    			set_style(path2, "fill-rule", "nonzero");
    			set_style(path2, "opacity", "1");
    			attr(path2, "transform", " matrix(1 0 0 1 0 0) ");
    			attr(path2, "stroke-linecap", "round");
    			set_style(g, "stroke", "none");
    			set_style(g, "stroke-width", "0");
    			set_style(g, "stroke-dasharray", "none");
    			set_style(g, "stroke-linecap", "butt");
    			set_style(g, "stroke-linejoin", "miter");
    			set_style(g, "stroke-miterlimit", "10");
    			set_style(g, "fill", "none");
    			set_style(g, "fill-rule", "nonzero");
    			set_style(g, "opacity", "1");
    			attr(g, "transform", "translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)");
    			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr(svg, "xmlns:xlink", "http://www.w3.org/1999/xlink");
    			attr(svg, "version", "1.1");
    			attr(svg, "width", "50");
    			attr(svg, "height", "50");
    			attr(svg, "viewBox", "0 0 256 256");
    			attr(svg, "xml:space", "preserve");
    			attr(span0, "class", "tree-counter");
    			attr(span1, "class", "small-inprint svelte-10fovpp");
    			attr(p, "class", "svelte-10fovpp");
    			attr(div, "class", "widget-container svelte-10fovpp");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, svg);
    			append(svg, defs);
    			append(svg, g);
    			append(g, path0);
    			append(g, path1);
    			append(g, path2);
    			append(div, t0);
    			append(div, p);
    			append(p, t1);
    			append(p, t2);
    			append(p, br0);
    			append(p, t3);
    			append(p, span0);
    			append(p, br1);
    			append(p, t5);
    			append(p, br2);
    			append(p, t6);
    			append(p, span1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { customerId } = $$props;

    	const customers = [
    		{
    			id: 111111,
    			name: 'ImpactHero',
    			trees: 100000,
    			type: 'tree'
    		},
    		{
    			id: 222222,
    			name: 'MarcelSomething',
    			trees: 140,
    			type: 'tree'
    		},
    		{
    			id: 333333,
    			name: 'AEC Europe',
    			trees: 2500,
    			type: 'tree'
    		}
    	];

    	function getCustomer(id) {
    		let customer = customers.find(customer => customer.id == id);
    		return customer; //return something if not found, default
    	}

    	let customer = getCustomer(customerId);

    	$$self.$$set = $$props => {
    		if ('customerId' in $$props) $$invalidate(1, customerId = $$props.customerId);
    	};

    	return [customer, customerId];
    }

    class Embed extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { customerId: 1 }, add_css);
    	}
    }

    const div = document.createElement('div');
    const script = document.currentScript;
    script.parentNode.insertBefore(div, script);

    let customerId = document.currentScript.getAttribute('data-customer-id');

    //can use this id to make other request to get the tree numbers etc.
    new Embed({
        target: div,
        props: { customerId: customerId},
    });

})();
