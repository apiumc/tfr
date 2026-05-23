


(function ($) {
    var Page = {};
    $(function ($) {
        $.UI.On('XHR', function (e, v) {
            $(document.body).cls('wdk-loading', v == 0);
        });
        $(document.body).on('click', 'a[model],button[model]', function () {
            var m = $(this);
            UMC.UI.Command(m.attr('model'), m.attr('cmd'), m.attr('send') || '');
            return false;

        }).on('click', 'a[ui-event]', function (e) {
            var m = $(this);
            m.parent('div[ui].ui').on('event', m.attr('ui-event'), m, e);
            return false;

        });

        if ($.SPA) {
            $(window).on('hashchange', function () {
                var hash = location.hash.substring(1);
                var path = hash.split('?')[0];
                if (Page[path]) {
                    history.replaceState(null, null, $.SPA + hash);
                    requestAnimationFrame(function () { win.on('popstate') });
                } else {
                    for (var k in tplt) {
                        if (path.indexOf(k + '/') == 0) {
                            history.replaceState(null, null, $.SPA + hash);
                            requestAnimationFrame(function () { win.on('popstate') });
                            break;
                        }
                    }
                }

            })
        }
    });

    var links = {};
    $.page = function (u, t, s, f) {
        if ($.isfn(t)) {
            f = t;
            t = null;
            s = true;
        } else if ($.isfn(s)) {
            f = s
            s = true;
        }
        if ($.isfn(f)) {
            delete Page[u];
            Page[u] = {
                title: t,
                search: s,
                init: f
            }
        } else if (arguments.length == 0) {
            return Page;
        } else {
            switch (typeof Page[u]) {
                case 'string':
                case 'undefined':
                    Page[u] = true;
                    break;
            }
        }
        return $;
    }

    $.shift = function (t, k) {
        Page[t] = k;
        return $;
    }
    $.script = function () {
        var l = arguments.length;
        for (var i = 0; i < l; i++) {
            var v = arguments[i];
            if (!(v in links)) {
                links[v] = 0;
            }
        }
        return WDK;
    }
    function preUrl(src) {
        if (src.indexOf('://') > 0 || !src.startsWith('/')) {
            return src
        }
        if (UMC.Src) {
            var start = UMC.Src.indexOf('://');
            if (start > -1) {
                var s = UMC.Src.indexOf('/', start + 4);
                if (s > -1) {
                    return UMC.Src.substr(0, s) + src
                } else {
                    return src
                }

            } else {
                return src
            }
        } else {
            return src
        }

    }
    $.link = function (src) {
        if (!links[src]) {
            links[src] = 1;
            var link = document.createElement('link')
            link.rel = 'stylesheet'
            link.type = 'text/css';
            link.href = preUrl(src);
            $('head').append(link);
        }
        return $;
    }
    var tasks = [];
    function task(fn, srcs) {
        if (arguments.length) {
            this.fn = $.isfn(fn) ? fn : function () { };
            this.srcs = srcs || [];

        } else {
            tasks.shift().fn();
            if (tasks.length) {
                tasks[0].run();
            }
        }
    }
    task.prototype.run = function () {
        this.loaded = 0;
        var me = this;
        var l = me.length = me.srcs.length;
        if (l == 0)
            task();
        for (var i = 0; i < l; i++) {
            $({ tag: 'script', src: preUrl(me.srcs[i]) }).on('load,error', function () {
                me.loaded++;
                if (me.loaded == me.length) {
                    requestAnimationFrame(function () {
                        task();
                    });
                }
            }).appendTo($('head'));
        }

    }
    $.wait = function (fn) {
        var srcs = [];
        for (var k in links) {
            if (links[k] === 0) {
                links[k] = 1;
                srcs.push(k);
            }
        }
        tasks.push(new task(fn, srcs));
        if (tasks.length == 1) {
            tasks[0].run();
        }
        return $;

    }

    var tplt = {};
    $.tpl = function (p, s, f, t) {
        switch (typeof f) {
            case 'string':
                t = f;
        }
        switch (typeof s) {
            case 'function':
                s = p;
                f = s;
                break;
            case 'undefined':
            case 'boolean':
                s = p;
                break;

        }
        tplt[p] = {
            src: s,
            init: f,
            title: t
        }
        return $;
    }
    $.check = function (u) {
        var k = u.split('/')[0];
        return (tplt[u] || Page[u]) ? true : ((tplt[k] || Page[k]) ? true : false);
    }
    $.res = function () {
        var g = [$.Src || ''];
        var v;
        while (v = arguments[g.length - 1]) {
            g.push(v)
        }
        $.UI.Ver ? g.push("?_v=", $.UI.Ver) : 0;// + __p.Ver : ''
        return g.join('');
    }
    $.UI.On("DataEvent", function (e, p, v) {
        var eKey = p.type;
        for (var k in Page) {
            var page = Page[k];
            if (page.root) {
                var root = page.root;
                if (!root.is('.ui')) {
                    var es = root.prop('_ls') || {};
                    if ((eKey in es)) {
                        var evdata = root[0].eventData || {};
                        evdata[eKey] = p;
                        root[0].eventData = evdata;
                    }
                }
            }
        }

    });
    var win = $(window).on('page', function (e, path, hashValue) {
        let ps = Page[path];
        if (typeof ps == 'string') {
            path = ps;
            ps = Page[path];
        }
        var value = UMC.query(hashValue || 'main');

        if (!ps) {
            var tpl = false;
            var klength = 0;
            var uiKey = '';
            for (var k in tplt) {
                if (path.indexOf(k + '/') == 0) {
                    if (klength < k.length) {
                        tpl = tplt[k];
                        klength = k.length;
                        uiKey = path.substring(k.length + 1);
                    }
                }
            }
            if (tpl) {
                var isCache = false;
                $(UMC.UI.EventUI || 'body').children('div[ui]')
                    .each(function () {
                        var m = $(this);
                        if (m.attr('ui') == path) {
                            isCache = true;
                            return false;
                        }
                    });
                if (isCache) {
                    Page[path] = { init: tpl.init, search: tpl.search || false, tpl: true, title: tpl.title };
                    win.on('page', path, hashValue);
                }
                else if (tpl.root) {
                    $(tpl.root.cloneNode(true)).attr('ui', path).attr('ui-key', uiKey).appendTo(UMC.UI.EventUI || 'body')
                    Page[path] = { init: tpl.init, search: tpl.search || false, tpl: true, title: tpl.title };
                    win.on('page', path, hashValue);
                } else {

                    var xhr = new XMLHttpRequest();
                    xhr.onload = function () {
                        tpl.root = $(document.createElement("div")).html(xhr.responseText).children("div").remove()[0];
                        if (tpl.root) {
                            tpl.init ? win.on('page', path, hashValue) : $.script($.res(tpl.src, '.js'))
                                .wait(function () {
                                    win.on("page", path, hashValue);
                                });
                        }
                    };
                    xhr.open('GET', $.res(tpl.src, '.html'), true);
                    xhr.send('');
                }
            } else {
                var key = path.substring(0, path.indexOf('/'));

                if (key && (Page[key] == true)) {
                    delete Page[key];
                    $.script($.res(key, '.js'))
                        .wait(function () {
                            if (Page[path] || tplt[key] || tplt[path.substring(0, path.lastIndexOf('/'))]) {
                                win.on("page", path, hashValue);
                            }
                        });
                } else {
                    return false;
                }

            }
        } else if (ps === true) {
            var xhr = new XMLHttpRequest();

            xhr.onload = function () {
                $(document.createElement("div")).html(xhr.responseText).children("div").each(function () {
                    var m = $(this);
                    if (!m.attr('ui')) {
                        m.attr('ui', path);
                    }
                }).appendTo(UMC.UI.EventUI || 'body');
                $.script($.res(path, '.js')).wait(function () {
                    if (Page[path] === true) {
                        delete Page[path];
                    }
                    win.on("page", path, hashValue);
                });
            };
            xhr.open('GET', $.res(path, '.html'), true);
            xhr.send('');

        } else if (ps.root) {
            var em = ps.root;
            $.UI.On('UI.Push', ps, path);
            let p = parseInt(em.attr('p')) || 0;
            let h = em.attr('hash') || '';
            if (h != hashValue || p != location.pathname.length) {
                hashValue !== true ? em.attr('hash', hashValue) : 0;
                em.attr('p', location.pathname.length + '')
                em.on('hash', value, hashValue, h, location.pathname.length, p);
            }

            var evdata = em[0].eventData || {};
            delete em[0].eventData;
            for (var key in evdata) {
                em.on.apply(em, ['UI.' + key, evdata[key]]);
            }
        } else {
            $($.UI.EventUI || 'body').children('div[ui]')
                .each(function () {
                    var m = $(this);
                    if (m.attr('ui') == path) {
                        ps.root = m.remove();

                        return false;
                    }
                });
            if (ps.root) {
                var th = function () {
                    ps.root.attr('hash', hashValue)
                    ps.root.on('hash', value, hashValue);
                }

                $.UI.On('UI.Push', ps);
                if ($.isfn(ps.init)) {
                    ps.menu = [];
                    ps.root.on('menu', function (e, v) {
                        if (Array.isArray(v)) {
                            ps.menu = v;
                        } else {
                            var isOk = false;
                            for (var i = 0; i < ps.menu.length; i++) {
                                if (ps.menu[i].key == v.key) {
                                    $.extend(ps.menu[i], v);
                                    isOk = true;
                                    break;
                                }
                            }
                            if (!isOk) {
                                ps.menu.push(v);
                            }
                        }
                        requestAnimationFrame(function () {
                            win.on('menu', ps.menu);
                        })

                        return false;
                    }).on('title', function (e, v) {
                        ps.title = v;
                        requestAnimationFrame(function () {
                            win.on('title', ps.title);
                        })
                        return false;
                    });
                    ps.init(ps.root);
                    delete ps.init;
                }
                ps.time = new Date().getTime();
                tasks.length ? tasks.push(new task(th)) : th();

            } else {
                var xhr = new XMLHttpRequest();
                xhr.onload = function () {
                    $(document.createElement("div")).html(xhr.responseText).children("div")
                        .attr('ui', path).appendTo(UMC.UI.EventUI || 'body').length ?
                        win.on("page", path, hashValue) : 0;
                };
                xhr.open('GET', $.res(path, '.html'), true);
                xhr.send('');
            }
        }

    }).on('popstate', function (e) {
        if ($.SPA) {
            win.on('page', location.pathname.substring(($.SPA || '/').length) || 'main', location.search.substring(1));
        } else {
            var hash = location.hash.substring(1);
            var pindex = hash.indexOf('?');
            if (pindex == -1) pindex = hash.length;
            var path = (hash.substr(0, pindex) || '').replace(/^\/|\/$/g, '') || 'main';
            var hashValue = hash.substring(pindex + 1);
            win.on('page', path, hashValue);
        }
    }).click('a[ui-spa]', function () {
        var m = $(this);
        var href = m.attr('href') || '#';
        var spa = m.attr('ui-spa') || '';
        if (href == '#') {
            var cdata = m.attr('click-data');
            if (cdata) {
                var cd = JSON.parse(cdata);
                if (m.is('a[ui-design]')) {
                    var sd = cd.send || {};
                    var x = m.offset();
                    sd.Size = x.width + "x" + x.height
                }
                $.Click(cd);
                return;
            }
            if (spa) {
                win.on('page', spa, '');
                return;
            }
            href = ($.SPA || '') + spa
        }
        if (href.startsWith('/UMC/')) {
            var hrefs = href.substring(1).split('?');
            var paths = hrefs[0].replace(/(^\/+)|(\/+$)/g, '').split('/');
            paths.shift();
            if (paths.length > 1) {
                var search = {};
                var model = paths.shift();
                var cmd = paths.shift();
                var search = $.query(hrefs[1] || '');
                if (paths.length) search._ = paths.join('/');
                $.UI.Command(model, cmd, search);
                return false;
            }
        }
        if ($.SPA && href.charAt(0) == '#') {
            href = (href.length == 1 ? $.SPA : ($.SPAPfx || $.SPA)) + href.substring(1);
        }
        if ($.SPA) {
            history.pushState(null, null, href);
            requestAnimationFrame(function () { win.on('popstate') });
        } else {
            location.hash = href;
        }
        return false;

    });
    $.nav = function (key) {
        if ($.SPA) {
            history.pushState(null, null, key);
            requestAnimationFrame(function () { win.on('popstate') });
        } else {
            location.hash = href;
        }
    }
    $.scroll = function (s, t) {
        var con = $(s);
        var src = con[0];
        var ofset = t.offset();
        var top = ofset.top - con.offset().top;
        var stop = src.scrollTop + top + 20;
        var sctop = src.scrollTop;
        var num = (stop > sctop) ? 50 : -50;
        function run() {
            sctop = sctop + num;
            if (num > 0) {
                if (sctop >= stop) {
                    sctop = stop
                } else {
                    requestAnimationFrame(run);
                }
            } else {

                if (sctop <= stop) {
                    sctop = stop
                } else {
                    requestAnimationFrame(run);
                }
            }

            src.scrollTop = sctop;
        }
        run();
    }

})(UMC)