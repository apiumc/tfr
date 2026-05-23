

(function ($) {
    UMC.UI.Config({ possrc: '/UMC.', posurl: '/UMC/' });
    UMC.Src = 'https://www.apiumc.com/UI/';
    UMC.SPA = '/itme/';
    window.addEventListener('message', (e) => {
        if (e.origin !== location.origin) {
            switch (e.data.type) {
                case 'tfr.sh':
                    fetch('/p/bash', {
                        method: 'PUT', body: JSON.stringify({
                            url: e.data.url
                        })
                    })
                    break
            }
        }
    });

    document.title = UMC.UI.Config().title || document.title || 'API UMC';

    $.UI.On("UI.Show", function (e, v) {
        var doc = WDK(document.createElement("div")).addClass('weui_mask')
            .click(function () {
                WDK('div[ui].wdk-dialog').addClass('right').removeClass('ui');
            })
            .appendTo(document.body);
        v.on('close', function () {
            doc.remove();
        });
    });
    $.UI.EventUI = 'section.app-main';
    $.UI.Off('Prompt')
        .On("Prompt", function (e, p) {

            const toast = document.getElementById('tfr-toast');
            document.getElementById('toast-text').innerText = p.Text;
            toast.classList.add('show');
            if (window.toastTimer) clearTimeout(window.toastTimer);
            window.toastTimer = setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        });

    $.UI.On('UI.Push', function (e, xhr) {
        $('.navbar #header-search').cls('hide', xhr.search == false);
        var app = $('section.app-main');
        var last = app.children('div.ui').cls('ui', 0);
        if (last.on('backstage') !== false)
            last.remove();
        if (xhr.root.cls('ui', 1).parent()[0] != app[0]) {
            xhr.root.appendTo(app);
        }
        xhr.root.on('active');
        var ocls = app.attr('app-cls') || app.attr('append-cls');
        var cls = xhr.root.attr('app-cls');
        app.attr('app-cls', cls);
        app.parent('#app').cls('hideSidebar', xhr.root.is('div[hidesidebar]'))
            .cls('hideScrollbar', xhr.root.is('div[hidescrollbar]'));

        $(document.body).cls(ocls || '', 0).cls(cls || '', 1);

        $(window).on('title', xhr.title).on("menu", xhr.menu || []);
    }).On('User', function (e, v) {
        $('.sidebar-logo-container a')
            .attr('data-name', v.Alias.substr(0, 1)).find('img').attr('src', v.Src);
        $('.umc-logo-name').text(v.Alias);

        $('section.app-main').parent('#app').removeClass('initing');

    }).On('Close', function () {
        location.reload(false);
    });

    $(function ($) {


        var app = $('section.app-main');

        function itemClick(e) {
            var me = $(this);
            var key = me.attr('key');
            if (key) {
                app.children('div[ui].ui').last().on('event', key, e);
            } else {
                var click = me.attr('click-data');
                if (click) {
                    $.Click(JSON.parse(click));
                }
            }
        }
        var menu = $('.navbar #menu').click('a', itemClick);
        var title = $('#breadcrumb-container').click('a', itemClick);
        var search = $('#header-search');
        search.siblings('ul').click('li a', itemClick);
        $(window).on('title', function (e, vs2) {
            title.children().remove();
            var vs = [].concat(vs2);
            for (var i = 0; i < vs.length; i++) {
                var v = vs[i];
                if (typeof v == 'object') {
                    var a = $(document.createElement('a')).text(v.text).attr('key', v.key || false);
                    v.click ? a.attr('click-data', JSON.stringify(v.click)) : 0;
                    v.icon ? a.attr('data-icon', v.icon) : 0
                    a.appendTo(title);
                } else {
                    $(document.createElement('span')).text(v + '').appendTo(title);
                }
            }
        }).on('menu', function (e, vs) {
            menu.children().remove();
            if (Array.isArray(vs)) {
                for (var i = 0; i < vs.length; i++) {
                    var v = vs[i];
                    if (typeof v == 'object') {
                        var a = $(document.createElement('a')).text(v.text || '').attr('key', v.key || false);
                        v.click ? a.attr('click-data', JSON.stringify(v.click)) : 0;
                        v.icon ? a.attr('data-icon', v.icon) : 0
                        a.appendTo(menu);
                    }
                }
            }
        }).on('select', function (e, vs) {
            var m = search;
            var menu = m.siblings('*[role=menu]');
            if (m.is('.is-active') == false) {

                var rect = search[0].getBoundingClientRect();
                m.cls('is-active', 1);
                var mask = $(document.createElement('div')).addClass('weui_mask')
                    .click(function () {
                        $(this).remove();
                        m.cls('is-active', 0);
                        menu.css('transform', 'translateX(-1000px)');
                    }).css({
                        opacity: '0',
                        'z-index': '0'
                    }).appendTo(document.body);

                menu.css('transform', ['translate(', (rect.left), 'px,', (rect.top + rect.height + 5), 'px)'].join(''))
                    .click(function () {
                        mask.click();
                    }, 1);
            }

            menu.children().remove();

            if (vs.length == 0) {
                $(document.createElement('li')).addClass('umc-search-empty').appendTo(menu)
            } else {
                for (var i = 0; i < vs.length; i++) {
                    var v = vs[i];
                    if (typeof v == 'object') {
                        var a = $(document.createElement('a')).text(v.text || '').attr('key', v.key || false);
                        v.click ? a.attr('click-data', JSON.stringify(v.click)) : 0;
                        v.icon ? a.attr('data-icon', v.icon) : 0
                        $(document.createElement('li')).append(a).appendTo(menu);
                    }
                }
            }


        }).on('message', function (e) {
            var win = e.source;
            var dom = false;
            $('.el-link iframe').each(function () {
                if (this.contentWindow == win) {
                    dom = $(this).parent('.el-link');
                    return false;
                }
            });
            if (dom === false) {
                return;
            }

            var data = JSON.parse(e.data);

            switch (data.type) {
                case 'close':
                    history.back();
                    break;
                case 'open':
                    var value = data.value;
                    value.id = new Date().getTime() / 1000;
                    value.url = value.src;
                    delete value.src;
                    UMC.NAV[value.id] = value;
                    $.nav('Link/' + value.id);
                    break;
                case 'search':
                case 'title':
                case 'menu':
                    dom.on(data.type, data.value);
                    break;
                case "event":
                    dom.ui(data.value, function (e, v, r) {
                        if (r.Scope == 'self') {
                            $(this).find('iframe')[0].contentWindow.postMessage(JSON.stringify({
                                type: 'event',
                                data: v
                            }), "*");
                        }
                    });
                    break;
                case 'msg':
                    $.UI.Msg(data.value);
                    break;
                case 'umc':
                    var bridge = new Bridge(dom.attr('id'));
                    bridge.key = data.key;
                    var xhr = new XMLHttpRequest();
                    xhr.onload = function () {
                        bridge.bridge(JSON.parse(xhr.responseText));
                    };
                    xhr.open('POST', UMC.UI.Config().posurl, true);
                    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                    xhr.send(data.value.replace(/(^\&*)/g, ""));
                    break;
                default:
                    break;
            }
        }).on('fullscreenchange,webkitfullscreenchange,mozfullscreenchange', function () {
            $(document.body).cls('umc-fullscreen', document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen);
        });


        $('#hamburger-container').click(function () {
            $(document.body).children('#app').cls('hideSidebar');
        });

        search.find('form').submit(function () {
            var input = $(this).find('input');
            var value = input.val();
            var root = $('section.app-main>div[ui].ui');
            root.on('search', value, input) !== false ?
                root.find('.pagination-container')
                    .on('search', value) : 0;
            return false;
        }).find('input').on('input', function () {
            var input = $(this);
            var value = input.val();
            if (!value) {
                search.siblings('*[role=menu]').click();
            } else {
                var root = $('section.app-main>div[ui].ui');
                root.on('searchValue', value, input);
            }

        })
    });



    UMC.NAV = {};

    $(function () {
        const codeInputs = document.querySelectorAll('.code-input');
        const keyBtns = document.querySelectorAll('.key-btn[data-num]');
        const deleteBtn = document.querySelector('.key-btn.delete');
        let currentIndex = 0;
        document.querySelector('.key-btn.webauthn').addEventListener('click', () => {
            WebAuthn()
        });


        // ====================== 屏幕数字键盘点击 ======================
        keyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (currentIndex < 6) {
                    codeInputs[currentIndex].value = btn.dataset.num;
                    moveToNext();
                }
            });
        });

        // ====================== 物理键盘输入支持（核心升级） ======================
        codeInputs.forEach((input, index) => {
            // 数字输入
            input.addEventListener('input', (e) => {
                const val = e.target.value.replace(/\D/g, ''); // 只保留数字
                e.target.value = val;

                if (val) {
                    moveToNext();
                }
            });

            // 回退键删除
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace') {
                    if (!input.value && currentIndex > 0) {
                        moveToPrev();
                    }
                } else if (e.key === 'Enter' && !confirmBtn.disabled) {
                    confirmBtn.click();
                }
            });

            // 禁止输入非数字
            input.addEventListener('keypress', (e) => {
                if (!/\d/.test(e.key)) {
                    e.preventDefault();
                }
            });
        });

        // ====================== 删除按钮 ======================
        deleteBtn.addEventListener('click', () => {
            if (currentIndex > 0) {
                moveToPrev();
            }
        });

        // ====================== 工具函数：后移/前移 ======================
        function moveToNext() {
            currentIndex++;
            if (currentIndex < 6) {
                codeInputs[currentIndex].focus();
            }
            checkCodeComplete();
        }

        function moveToPrev() {
            currentIndex--;
            codeInputs[currentIndex].value = '';
            codeInputs[currentIndex].focus();
            checkCodeComplete();
        }
        // atob
        // 检查是否输入完成
        async function checkCodeComplete() {
            let code = Array.from(codeInputs).map(i => i.value).join('');
            if (code.length == 6) {
                if (deleteBtn.totp) {
                    if (await verifyTOTP(deleteBtn.config.secret, code)) {
                        if (!deleteBtn.config.init) {
                            delete deleteBtn.totp;
                            $('.verify-container .title').text("4/4、授权口令验证");//, "4/4.Authorization Passcode Verification.");
                            let container = deleteBtn.closest('.verify-container');
                            container.classList.remove('init');
                            container.classList.add("show", "auth");
                            resetCodeInput();
                            return
                        }
                    } else {
                        $.UI.Msg("口令不正确");
                        return;
                    }
                }
                var value = { code: code };
                if (deleteBtn.config) {
                    value.secret = btoa(String.fromCharCode(...new Uint8Array(deleteBtn.config.secret)));
                    value.alias = deleteBtn.config.alias;
                }
                fetch('/p/totp', {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(value)
                }).then(r => r.text()).then(r => {
                    xhr = JSON.parse(r);
                    if (xhr.success) {
                        if (!deleteBtn.config || deleteBtn.config.init) {
                            location.reload(false);
                        } else {
                            let login = $(document.querySelector('.verify-container'));
                            login.removeClass('show');
                            $.UI.Msg("设置成功");

                            var vs_value = JSON.parse(localStorage.getItem('webauthn') || '[]');
                            vs_value.push(deleteBtn.webauthn);
                            localStorage.setItem("webauthn", JSON.stringify(vs_value));
                        }
                    } else {
                        $.UI.Msg("口令不正确");
                        resetCodeInput();
                    }
                });
            }
        }


        // 重置
        function resetCodeInput() {
            codeInputs.forEach(i => i.value = '');
            currentIndex = 0;
            codeInputs[0].focus();
        }
        window.resetCodeInput = resetCodeInput;

        UMC(document.body).on('UI.Key.Url', function (e, v) {
            location.href = v;
        });

        UMC.shift('main', 'bridge');
        $.page('xterm');

        $.UI.On('User', function () {
            var pathname = location.pathname;
            if (pathname.length > $.SPA.length) {
                var key = pathname.substring($.SPA.length).split('/')[0];
                if (key == 'bridge') {
                    $(window).on('popstate');
                } else {
                    $.page(key);
                    $(window).on('page', key || 'bridge', '');
                }
            } else {
                $(window).on('popstate');
            }

        }).On('Login', function (e, v) {
            fetch('/p/totp').then(r => r.text()).then(r => {
                let login = $(document.querySelector('.verify-container'));
                var data = JSON.parse(r);
                if (data.code == 'init') {
                    login.find('.title').text('设备口令初始化');
                    deleteBtn.config = { init: true }

                    var secret = crypto.getRandomValues(new Uint8Array(8));
                    deleteBtn.totp = true;
                    deleteBtn.config.secret = secret;
                    let totp_url = ['otpauth://totp/itme?secret=', base32Encode(secret), '&issuer=itme'].join('')

                    var qrcode = new QRCode(login.find(".qrcode").html('')[0], {
                        width: 200,
                        height: 200
                    });
                    qrcode.makeCode(totp_url);
                    login.find('img').css({
                        margin: '10px auto',
                        border: '1px solid #dcdfe6',
                        padding: '10px'
                    });
                    login.addClass('show init');

                    resetCodeInput();
                } else {
                    login.addClass('show');
                    resetCodeInput();
                }
            });
        }).On('Desktop', {});
        $.UI.Command("ITME", "Xterm", "Info", function (xhr) {
            $.UI.On('User', { Alias: xhr.caption || '未设置', Src: xhr.src });
        });

    });



    const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    function base32Encode(input) {
        const bytes = typeof input === 'string'
            ? new TextEncoder().encode(input)
            : input;

        let bits = 0;
        let value = 0;
        let result = '';

        for (const b of bytes) {
            value = (value << 8) | b;
            bits += 8;

            while (bits >= 5) {
                bits -= 5;
                const idx = (value >>> bits) & 0x1F;
                result += BASE32_CHARS[idx];
            }
        }

        if (bits > 0) {
            const idx = (value << (5 - bits)) & 0x1F;
            result += BASE32_CHARS[idx];
        }
        return result;// + '='.repeat(padLen);
    }
    async function verifyTOTP(secretKey, userInputCode, period = 30, digits = 6) {
        try {
            const time = Math.floor(Date.now() / 1000 / period);
            const timeBuffer = new ArrayBuffer(8);
            const view = new DataView(timeBuffer);
            view.setBigUint64(0, BigInt(time), false);

            // 3. 用 HMAC-SHA1 签名（标准 TOTP）
            const cryptoKey = await crypto.subtle.importKey(
                "raw", secretKey, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
            );
            const signature = await crypto.subtle.sign("HMAC", cryptoKey, timeBuffer);

            // 4. 计算出 6 位验证码
            const code = getCodeFromSignature(signature, digits);

            // 5. 对比用户输入（安全比较）
            return secureCompare(code.toString().padStart(digits, '0'), userInputCode.trim());
        } catch (e) {
            return false;
        }
    }
    // ------------------------------
    // 工具函数：从签名计算 TOTP 码
    // ------------------------------
    function getCodeFromSignature(signature, digits) {
        const hmac = new Uint8Array(signature);
        const offset = hmac[hmac.length - 1] & 0x0F;
        const binary = ((hmac[offset] & 0x7F) << 24) |
            ((hmac[offset + 1] & 0xFF) << 16) |
            ((hmac[offset + 2] & 0xFF) << 8) |
            (hmac[offset + 3] & 0xFF);
        return binary % Math.pow(10, digits);
    }

    // ------------------------------
    // 工具函数：安全字符串比较
    // ------------------------------
    function secureCompare(a, b) {
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0 && a.length === b.length;
    }


    // 使用
    function getWebAuthnPublicKey(attestationObject) {
        const decoded = CBOR.decode(attestationObject);
        const authData = new Uint8Array(decoded.authData);
        const view = new DataView(authData.buffer);

        // 2. 解析 authData 结构
        let off = 37;
        off += 16; // 跳过 AAGUID（16 字节）

        const credIdLen = view.getUint16(off);
        off += 2;
        off += credIdLen; // 跳过 credential ID

        // 3. 剩下的就是 COSE 公钥（CBOR）
        const coseBuf = authData.slice(off);
        const cose = CBOR.decode(coseBuf.buffer);

        // ES256/P-256 固定键：-2 = X, -3 = Y
        const x = cose[-2];
        const y = cose[-3];

        // 4. 非压缩原始公钥：04 + X + Y
        return new Uint8Array([0x04, ...x, ...y]);
    }
    function derToRawSignature(derSignature) {
        const u8 = new Uint8Array(derSignature);
        let pos = 0;

        // 跳过 ASN.1 序列头
        if (u8[pos++] !== 0x30) throw new Error('Invalid signature');

        // 跳过总长度
        pos++;

        // 解析 r
        if (u8[pos++] !== 0x02) throw new Error('Invalid signature');
        const rLen = u8[pos++];
        const r = u8.slice(pos, pos + rLen);
        pos += rLen;

        // 解析 s
        if (u8[pos++] !== 0x02) throw new Error('Invalid signature');
        const sLen = u8[pos++];
        const s = u8.slice(pos, pos + sLen);

        // 统一转成 32 字节（去掉前导 0x00）
        const r32 = r.slice(r.length - 32);
        const s32 = s.slice(s.length - 32);

        // 拼接 r + s = 64 字节
        return new Uint8Array([...r32, ...s32]);
    }
    async function WebAuthn() {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        const timestamp = Math.floor(Date.now() / 1000);
        view.setUint32(0, timestamp, false);
        var challenge = new Uint8Array(buf);

        const loginOpts = {
            challenge: challenge,
            rpId: location.hostname,
            userVerification: "preferred",
            timeout: 60000
        };
        const assertion = await navigator.credentials.get({
            publicKey: loginOpts
        });
        const authData = new Uint8Array(assertion.response.authenticatorData);
        const clientData = new Uint8Array(assertion.response.clientDataJSON);

        // const hashBuffer = await crypto.subtle.digest('SHA-256', clientData);
        // const hashData = new Uint8Array(hashBuffer);

        // const verifyData = new Uint8Array(authData.length + hashData.length);
        // verifyData.set(authData, 0);
        // verifyData.set(hashData, authData.length);
        const signature = derToRawSignature(assertion.response.signature);


        fetch('/p/totp', {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                signature: btoa(String.fromCharCode(...signature)),
                authenticatorData: btoa(String.fromCharCode(...authData)),
                clientDataJSON: btoa(String.fromCharCode(...clientData)),
            })
        }).then(r => r.text()).then(r => {
            xhr = JSON.parse(r);
            if (xhr.success) {
                location.reload(false);
            } else {
                $.UI.Msg("未有此Web凭证");
                resetCodeInput();
            }
        });
    }
    async function registerWebAuthn() {
        const deleteBtn = document.querySelector('.key-btn.delete');

        try {
            // 1. 生成注册选项
            const options = {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rp: { name: "TFR", id: location.hostname },
                user: {
                    id: crypto.getRandomValues(new Uint8Array(16)),
                    name: deleteBtn.config.alias,
                    displayName: ["itme", deleteBtn.config.alias].join('/')
                },
                pubKeyCredParams: [
                    { type: "public-key", alg: -7 },
                ],
                timeout: 60000,
                attestation: "none",
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "preferred"
                }
            };

            const credential = await navigator.credentials.create({ publicKey: options });

            const rawId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
            const pub_key = getWebAuthnPublicKey(credential.response.attestationObject);
            deleteBtn.config.secret = pub_key;
            deleteBtn.webauthn = rawId;
            let container = deleteBtn.closest('.verify-container');
            container.querySelector('.title').textContent = "4/4、授权口令";
            container.classList.remove('init');
            container.classList.add("show", "auth");
        } catch (e) {
            // showToast({ zh: e.message, en: e.message });
            $.UI.Msg(e.message)
        }
    }


    $.error2 = function (e) {
        var m = document.createElement('em');
        m.className = 'icon';
        e.parentNode.replaceChild(m, e);
    }
    $.page('bridge', '我的应用', false, function (root) {
        root.on('menu', [{
            icon: '\uea04', key: 'Safe'
        }, {
            icon: '\uf08e', key: 'Xterm'
        }, {
            icon: '\uf011', key: 'Exit'
        }]);


        const deleteBtn = document.querySelector('.key-btn.delete');
        root.find('.item-container').click('em.app', function () {
            var me = $(this).parent();
            var k = me.attr('data-id');
            if (k) {
                if (me.is('.web')) {
                    $.UI.Command('Platform', 'Dns', { Model: 'App', _: k });

                } else {
                    $.UI.Command('Platform', 'Dns', { Model: 'Proxy', _: k });
                }
            } else if (me.is('.DoH')) {
                root.on('BridgeNone', 'Out');
            }

            return false;
        });
        root.find('.filter-apps').click('a', function () {
            var m = $(this);
            m.siblings('a').removeClass('selected');
            root.on('Group', m.addClass('selected').attr("key"));
        });

        root.on('select.node', function (e) {
            root.removeClass('resolver');
            var title = root.find('#bridgeTitle').text('我的互联节点');
            root.find('#bridgeDesc').text(title.attr('desc')).parent().addClass('info').removeClass('DoH');
            $.UI.Command('Platform', 'DoH', { Model: 'Site' }, function (xhr) {
                root.on('data.list', xhr);
            });
        }).on('event', function (e, v, em) {
            if (v) {
                switch (v) {
                    case "Exit": {
                        fetch('/p/totp', {
                            method: "DELETE"
                        }).then(r => r.text()).then(r => {
                            location.reload(false);
                        });
                    }
                        break;
                    case 'Safe': {
                        var dg = $.UI.Confirm('1/4、添加安全认证', '', function (value) {
                            deleteBtn.config = { alias: value.alias };
                            $.UI.Sheet('2/4、认证模式', [{ text: '动态口令（人员）' }, { text: '网页凭证（设备）' }], function (e, i) {
                                switch (i) {
                                    case 0:
                                        var secret = crypto.getRandomValues(new Uint8Array(8));
                                        deleteBtn.totp = true;
                                        deleteBtn.config.secret = secret;// base32Encode(secret);
                                        let totp_url = ['otpauth://totp/', encodeURIComponent(deleteBtn.config.alias), '?secret=', base32Encode(secret), '&issuer=itme'].join('')

                                        login.find('.title').html("3/4、设置动态口令");
                                        var qrcode = new QRCode(login.find(".qrcode").html('')[0], {
                                            width: 200,
                                            height: 200
                                        });
                                        qrcode.makeCode(totp_url);
                                        login.find('img').css({
                                            margin: '10px auto',
                                            border: '1px solid #dcdfe6',
                                            padding: '10px'
                                        })
                                        login.addClass('show init');
                                        resetCodeInput();
                                        break;
                                    case 1:
                                        delete deleteBtn.totp;// = true;
                                        registerWebAuthn()
                                        break;
                                }
                            });
                        });
                        var bd = dg.find('.weui_dialog_bd');
                        UMC({ tag: 'input', cls: 'el-input__inner lang-node', name: 'alias', placeholder: "认证别名" }).appendTo(bd);


                    }
                        break;
                    case "Xterm":
                        window.open("https://tfr.sh.cn/", "_blank");
                        break;
                    case 'Recharge':
                        if (em.attr('app-key')) {
                            UMC.UI.Command('Platform', 'Payment', { AuthKey: em.attr('app-key') })
                        } else {
                            UMC.UI.On('Login')
                        }
                        break;
                    case 'Combo':
                        if (em.attr('app-key')) {
                            UMC.UI.Command('Platform', 'Payment', { AuthKey: em.attr('app-key'), "Code": "Combo" })
                        } else {
                            UMC.UI.On('Login')
                        }
                        break;
                    case 'Bridge':
                        if (em.is('.info')) {
                            $.UI.Command('Platform', 'Dns', 'Dns');
                        }
                        else if (em.is('.DoH')) {
                            root.on('BridgeNone', 'Out');
                        }
                        break;
                    case 'Browser':
                        $.UI.On("Browser", em.attr('href'));
                        return false;
                    case 'App':
                        $.UI.Command('Platform', 'Dns', { __: 'App/New' });
                        break;
                    default:
                        $.UI.Command('Platform', 'Dns', v);
                        break;
                }
            }
        });

        root.on('hash', function () {
            root.on('select.node');
        }).on('BridgeNone', function (e, v) {
            $.UI.Command('Platform', 'DoH', v || 'Apps', function (x) {
                if (x.account) {
                    var xhr = x.account;
                    var desc = xhr.download ? "未运行IT管理引擎" : ['内网IP ', xhr.local, "个,解析IP ", xhr.pub, '个,中继IP ', xhr.vpn, '个'].join('');
                    root.find('#allowSize').text(xhr.bridgeText).parent().attr('app-key', xhr.key);
                    root.find('#expireTime').text(xhr.expireText);
                    root.find('#dns').text(xhr.allowText || '未充值或已耗尽').parent().attr('app-key', xhr.key);
                    root.find('#bridgeDesc').text(desc);
                    root.find('#bridgeTitle').attr('desc', desc);
                } else {
                    root.find('#bridgeTitle').attr('desc', '本机未登录');
                }

                // var list = [];
                // x.local.forEach(k => { list.push(k.text) });
                // root.find('#bridgeTitle').attr('text', list.join(','));

                root.on('select.node');
                root.find('#item-container').find('button').each(function () {
                    var me = $(this);
                    var key = me.attr('data-id');
                    key ? me.attr('data-value', x[key]) : 0;
                })
            })
        }).ui('User', function () {
            root.on('BridgeNone');
        }).on('BridgeNone');;
        var element = {};

        root.on('Group', function (e, v) {
            var fs = [];
            var afs = [];
            var data = element.sites || [];
            var apps = element.apps || [];
            if (v) {
                data.forEach(e => {
                    e.sites.forEach(r => {
                        if (r.domain.charAt(0) == v) {
                            r.group = e.text;
                            fs.push(r);
                        }
                    })
                });
                apps.forEach(r => {
                    if (r.root.charAt(0) == v) {
                        afs.push(r);
                    }
                });
            } else {
                data.forEach(e => {
                    e.sites.forEach(r => {
                        r.group = e.text;
                        fs.push(r);
                    })
                });
                afs = apps;
            }
            var html = [];

            html.push("<div class=\"umc-shortcuts\">");

            if (afs.length == 0) {
                if (v) {
                    html.push('<div class="umc-shortcut-empty search">', '未搜索到"', v, '", 相关的应用', '</div>');
                } else {
                    html.push('<div class="umc-shortcut-empty">未有发布的应用</div>');
                }
            } else {
                html.push($.format('<a title="{caption}" data-id="{root}"  target="_blank" href="{home}"  class="shortcut web"><em data-icon="{icon}" class="icon"></em><em class="title">{caption}</em><em class="desc">{root}</em><em class="app"></em></a>', afs, { icon: function (r) { return r.caption.charAt(0).toLocaleUpperCase() } }));
            }
            html.push("</div>");

            if (data.length > 0) {
                html.push("<div class=\"umc-shortcuts\">");
                if (fs.length == 0) {
                    if (v) {
                        html.push('<div class="umc-shortcut-empty search">', '未搜索到"', v, '", 相关的域名', '</div>');
                    } else {
                        if (!root.is('.resolver')) {
                            html.push('<div class="umc-shortcut-empty">', element.msg || '未发现域名, 请刷新', '</div>');
                        }
                    }

                } else if (root.is('.resolver')) {
                    html.push($.format('<a title="{text}" data-group="{group}" target="_blank" data-id="{domain}" href="{home}" class="shortcut"><img draggable="false" onerror="UMC.error2(this)" src="{src}" class="icon"/><em class="title">{domain}</em><em class="desc">{desc}</em><em class="app"></em></a>', fs));

                } else {
                    html.push($.format('<a title="{text}"  target="_blank" data-id="{domain}" href="{home}" class="shortcut"><img draggable="false" onerror="UMC.error2(this)" src="{src}" class="icon"/><em class="title">{domain}</em><em class="desc">{desc}</em><em class="app"></em></a>', fs));
                }
                html.push("</div>");
            }

            root.find('#item-container').removeClass('empty').html(html.join(''));

        });
        root.ui('Platform.Dns,Platform.Dns.Del', function () {
            $.UI.Command('Platform', 'DoH', { Model: 'Site' }, function (xhr) {
                root.on('data.list', xhr);
            });
        }).ui('DoH.Out', function () {
            root.on('select.node');
        }).on('data.list', function (e, xhr) {
            element = xhr;
            var ping = {};
            (element.sites || []).forEach(e => {
                e.sites.forEach(r => {
                    ping[r.domain.charAt(0)] = true;
                })
            });
            (xhr.apps || []).forEach(r => {
                ping[r.root.charAt(0)] = true;
            });


            var html = ['<a class="filter selected">全</a>'];
            var qty = 1;
            for (var k in ping) {
                qty++;
                html.push('<a class="filter" key="', k, '">', k.toLocaleUpperCase(), '</a>');
            }
            if (root.find('.filter-apps a').length != qty) {
                root.find('.filter-apps').html(html.join(''))
                root.on("Group");
            } else {
                root.on('Group', root.find('.filter-apps a.selected').attr("key") || '');
            }

        });
    });
})(UMC);
