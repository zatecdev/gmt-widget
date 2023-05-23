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
    function null_to_empty(value) {
        return value == null ? '' : value;
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
    function set_data(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        text.data = data;
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
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
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
    function create_component(block) {
        block && block.c();
    }
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

    /* Counter.svelte generated by Svelte v3.59.1 */

    function add_css$1(target) {
    	append_styles(target, "svelte-142c6g8", ".item.svelte-142c6g8.svelte-142c6g8{width:25%;height:100%;padding:50px 0px;text-align:center}.item.svelte-142c6g8.svelte-142c6g8:nth-child(1){background:rgb(16, 31, 46)}.item.svelte-142c6g8.svelte-142c6g8:nth-child(2){background:rgb(18, 34, 51)}.item.svelte-142c6g8.svelte-142c6g8:nth-child(3){background:rgb(21, 38, 56)}.item.svelte-142c6g8.svelte-142c6g8:nth-child(4){background:rgb(23, 44, 66)}.item.svelte-142c6g8 p.number.svelte-142c6g8{font-size:40px;padding:0;font-weight:bold}.item.svelte-142c6g8 p.svelte-142c6g8{color:rgba(255, 255, 255, 0.8);font-size:18px;margin:0;padding:10px;font-family:'Open Sans'}.item.svelte-142c6g8 span.svelte-142c6g8{width:60px;background:rgba(255, 255, 255, 0.8);height:2px;display:block;margin:0 auto}.item.svelte-142c6g8 i.svelte-142c6g8{vertical-align:middle;font-size:50px;color:rgba(255, 255, 255, 0.8)}.item.svelte-142c6g8:hover i.svelte-142c6g8,.item.svelte-142c6g8:hover p.svelte-142c6g8{color:white}.item.svelte-142c6g8:hover span.svelte-142c6g8{background:white}@media(max-width: 786px){.item.svelte-142c6g8.svelte-142c6g8{flex:0 0 50%}}");
    }

    function create_fragment$1(ctx) {
    	let div;
    	let i;
    	let i_class_value;
    	let t0;
    	let p0;
    	let t1_value = /*details*/ ctx[0].count + "";
    	let t1;
    	let t2;
    	let span;
    	let t3;
    	let p1;
    	let t4_value = /*details*/ ctx[0].caption + "";
    	let t4;

    	return {
    		c() {
    			div = element("div");
    			i = element("i");
    			t0 = space();
    			p0 = element("p");
    			t1 = text(t1_value);
    			t2 = space();
    			span = element("span");
    			t3 = space();
    			p1 = element("p");
    			t4 = text(t4_value);
    			attr(i, "class", i_class_value = "" + (null_to_empty(/*details*/ ctx[0].icon) + " svelte-142c6g8"));
    			attr(p0, "id", "number1");
    			attr(p0, "class", "number svelte-142c6g8");
    			attr(span, "class", "svelte-142c6g8");
    			attr(p1, "class", "svelte-142c6g8");
    			attr(div, "class", "item wow fadeInUpBig animated animated svelte-142c6g8");
    			attr(div, "data-number", "12");
    			set_style(div, "visibility", "visible");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, i);
    			append(div, t0);
    			append(div, p0);
    			append(p0, t1);
    			append(div, t2);
    			append(div, span);
    			append(div, t3);
    			append(div, p1);
    			append(p1, t4);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*details*/ 1 && i_class_value !== (i_class_value = "" + (null_to_empty(/*details*/ ctx[0].icon) + " svelte-142c6g8"))) {
    				attr(i, "class", i_class_value);
    			}

    			if (dirty & /*details*/ 1 && t1_value !== (t1_value = /*details*/ ctx[0].count + "")) set_data(t1, t1_value);
    			if (dirty & /*details*/ 1 && t4_value !== (t4_value = /*details*/ ctx[0].caption + "")) set_data(t4, t4_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { details } = $$props;

    	$$self.$$set = $$props => {
    		if ('details' in $$props) $$invalidate(0, details = $$props.details);
    	};

    	return [details];
    }

    class Counter extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { details: 0 }, add_css$1);
    	}
    }

    /* Widget.svelte generated by Svelte v3.59.1 */

    function add_css(target) {
    	append_styles(target, "svelte-8l206b", ".sectionClass.svelte-8l206b.svelte-8l206b{padding:20px 0px 50px 0px;position:relative;display:block}.fullWidth.svelte-8l206b.svelte-8l206b{width:80% !important;display:table;float:none;padding:0;min-height:1px;height:100%;position:relative;margin:0 auto}.projectFactsWrap.svelte-8l206b.svelte-8l206b{display:flex;margin-top:30px;flex-direction:row;flex-wrap:wrap}#projectFacts.svelte-8l206b .fullWidth.svelte-8l206b{padding:0}@media(max-width: 786px){}");
    }

    function create_fragment(ctx) {
    	let link0;
    	let t0;
    	let link1;
    	let t1;
    	let link2;
    	let t2;
    	let div2;
    	let div1;
    	let div0;
    	let counter0;
    	let t3;
    	let counter1;
    	let t4;
    	let counter2;
    	let t5;
    	let counter3;
    	let current;

    	counter0 = new Counter({
    			props: { details: /*customer*/ ctx[0].trees }
    		});

    	counter1 = new Counter({
    			props: { details: /*customer*/ ctx[0].hours }
    		});

    	counter2 = new Counter({
    			props: { details: /*customer*/ ctx[0].individuals }
    		});

    	counter3 = new Counter({
    			props: { details: /*customer*/ ctx[0].education }
    		});

    	return {
    		c() {
    			link0 = element("link");
    			t0 = space();
    			link1 = element("link");
    			t1 = space();
    			link2 = element("link");
    			t2 = space();
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			create_component(counter0.$$.fragment);
    			t3 = space();
    			create_component(counter1.$$.fragment);
    			t4 = space();
    			create_component(counter2.$$.fragment);
    			t5 = space();
    			create_component(counter3.$$.fragment);
    			attr(link0, "href", "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha3/dist/css/bootstrap.min.css");
    			attr(link0, "rel", "stylesheet");
    			attr(link0, "integrity", "sha384-KK94CHFLLe+nY2dmCWGMq91rCGa5gtU4mk92HdvYe+M/SXH301p5ILy+dN9+nJOZ");
    			attr(link0, "crossorigin", "anonymous");
    			attr(link1, "rel", "stylesheet");
    			attr(link1, "href", "https://fonts.googleapis.com/css?family=Open+Sans:400,700&");
    			attr(link2, "rel", "stylesheet");
    			attr(link2, "href", "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.4.0/css/font-awesome.min.css");
    			attr(div0, "class", "projectFactsWrap  svelte-8l206b");
    			attr(div1, "class", "fullWidth eight columns svelte-8l206b");
    			attr(div2, "id", "projectFacts");
    			attr(div2, "class", "sectionClass svelte-8l206b");
    		},
    		m(target, anchor) {
    			insert(target, link0, anchor);
    			insert(target, t0, anchor);
    			insert(target, link1, anchor);
    			insert(target, t1, anchor);
    			insert(target, link2, anchor);
    			insert(target, t2, anchor);
    			insert(target, div2, anchor);
    			append(div2, div1);
    			append(div1, div0);
    			mount_component(counter0, div0, null);
    			append(div0, t3);
    			mount_component(counter1, div0, null);
    			append(div0, t4);
    			mount_component(counter2, div0, null);
    			append(div0, t5);
    			mount_component(counter3, div0, null);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(counter0.$$.fragment, local);
    			transition_in(counter1.$$.fragment, local);
    			transition_in(counter2.$$.fragment, local);
    			transition_in(counter3.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(counter0.$$.fragment, local);
    			transition_out(counter1.$$.fragment, local);
    			transition_out(counter2.$$.fragment, local);
    			transition_out(counter3.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(link0);
    			if (detaching) detach(t0);
    			if (detaching) detach(link1);
    			if (detaching) detach(t1);
    			if (detaching) detach(link2);
    			if (detaching) detach(t2);
    			if (detaching) detach(div2);
    			destroy_component(counter0);
    			destroy_component(counter1);
    			destroy_component(counter2);
    			destroy_component(counter3);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { customerId } = $$props;

    	const customers = [
    		{
    			id: 111111,
    			name: 'ImpactHero',
    			trees: {
    				icon: 'fa fa-tree',
    				count: 10000,
    				caption: 'Trees planted'
    			},
    			hours: {
    				icon: 'fa fa-clock-o',
    				count: 25567,
    				caption: 'Hours of work provided'
    			},
    			individuals: {
    				icon: '	fa fa-user',
    				count: 1800,
    				caption: 'Individuals engaged'
    			},
    			education: {
    				icon: 'fa fa-briefcase',
    				count: 16899,
    				caption: 'Days of education provided'
    			}
    		},
    		{
    			id: 222222,
    			name: 'MarcelSomething',
    			trees: {
    				icon: 'fa fa-tree',
    				count: 2000,
    				caption: 'Trees planted'
    			},
    			hours: {
    				icon: 'fa fa-clock-o',
    				count: 546,
    				caption: 'Hours of work provided'
    			},
    			individuals: {
    				icon: '	fa fa-user',
    				count: 94,
    				caption: 'Individuals engaged'
    			},
    			education: {
    				icon: 'fa fa-briefcase',
    				count: 100,
    				caption: 'Days of education provided'
    			}
    		},
    		{
    			id: 333333,
    			name: 'AEC Europe',
    			trees: {
    				icon: 'fa fa-tree',
    				count: 11000,
    				caption: 'Trees planted'
    			},
    			hours: {
    				icon: 'fa fa-clock-o',
    				count: 15998,
    				caption: 'Hours of work provided'
    			},
    			individuals: {
    				icon: '	fa fa-user',
    				count: 869,
    				caption: 'Individuals engaged'
    			},
    			education: {
    				icon: 'fa fa-briefcase',
    				count: 2137,
    				caption: 'Days of education provided'
    			}
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

    class Widget extends SvelteComponent {
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
    // const embed = new Embed({
    //     target: div,
    //     props: { customerId: customerId},
    // });

    new Widget({
        target: div,
        props: { customerId: customerId},
    });

})();
