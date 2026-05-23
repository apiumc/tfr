let ws_id = false;
let fri_ids = {};
let tfr_sh_url = '';
let heartbeat_time_id = 0;
function toggleFolder(el) {
    el.classList.toggle('open');
}
// UMC.UI.Config({ 'posurl': 'https://api.apiumc.com/UMC/' });
let fri_id = '';

function toggleSelect(el, checkbox, counter) {
    if (!checkbox) {
        checkbox = el.querySelector('input[type="checkbox"]');
    }
    if (event.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
    }

    el.classList.toggle('selected', checkbox.checked);
    if (counter) {
        const c = counter;
        var tl = parseInt(c.textContent) || 0;
        if (checkbox.checked) {
            tl++;
        } else {
            tl--;
        }
        c.textContent = tl + '';
    }

}
let userFileNodes = [];

// ==========================
// 标准 USTAR TAR 流（可正常解压）
// ==========================
function createTarStream(files, model) {
    let fileIndex = 0;
    let currentFile;
    let reader;
    let pos = 0;

    return new ReadableStream({
        async start(controller) {
            await nextFile(controller);
        },
        async pull(controller) {
            if (!reader) return;
            const { done, value } = await reader.read();

            if (done) {
                const pad = (512 - (pos % 512)) % 512;
                if (pad) controller.enqueue(new Uint8Array(pad));

                await nextFile(controller);
                return;
            }

            controller.enqueue(value);
            pos += value.length;
        }
    });

    async function nextFile(controller) {
        if (fileIndex >= files.length) {
            // tar 结束符（2个空块）
            controller.enqueue(new Uint8Array(512));
            controller.enqueue(new Uint8Array(512));
            controller.close();
            return;
        }
        const node = files[fileIndex++];
        currentFile = node.file;

        const filePath = node.path || currentFile.webkitRelativePath || currentFile.name;
        const size = currentFile.size;
        const mtime = Math.floor(currentFile.lastModified / 1000);
        // 写入 TAR 头
        const header = createTarHeader(filePath, size, mtime, model || 0o644);
        controller.enqueue(header);

        pos = 0;
        // 读取文件
        reader = currentFile.stream().getReader();
    }
}
const enc = new TextEncoder();
function createTarHeader(filePath, size, mtime, mode) {
    const header = new Uint8Array(512);
    writeStr(header, 0, filePath, 100);
    writeOctal(header, 100, mode, 8);
    writeOctal(header, 108, 0, 8);
    writeOctal(header, 116, 0, 8);
    writeOctal(header, 124, size, 12);
    writeOctal(header, 136, mtime, 12);
    writeStr(header, 148, '        ', 8);
    header[156] = 0x30;
    writeStr(header, 257, 'ustar', 6);
    writeStr(header, 263, '00', 2);

    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += header[i];
    writeOctal(header, 148, checksum, 6);
    header[154] = 0x20;
    header[155] = 0;
    return header;
}

function writeStr(buf, off, str, max) {
    const b = enc.encode(str);
    for (let i = 0; i < max && i < b.length; i++) buf[off + i] = b[i];
}

function writeOctal(buf, off, val, len) {
    const s = val.toString(8).padStart(len - 1, '0') + '\0';
    writeStr(buf, off, s, len);
}
const msgFN = {};

if (location.pathname.startsWith('/a/')) {
    let paths = location.pathname.split('/').filter(r => r);
    if (paths.length > 1)
        localStorage.setItem('distributor', paths[1]);

}
async function message(msg) {
    if (msg) {
        switch (msg.type) {
            case 'xterm':
                xterm(msg)
                break;
            case 'RFriend':
                delete fri_ids[msg.ws];
                localStorage.setItem("Friend", JSON.stringify(fri_ids));
                break;
            case 'ws':
                if (ws_id != msg.ws) {
                    ws_id = msg.ws;
                    if (window.opener) {
                        hash = location.hash.slice(1);
                        if (hash) {
                            sessionStorage.setItem('hash', hash)
                        } else {
                            hash = sessionStorage.getItem('hash') || ''
                        }
                        setTimeout(function () {
                            window.opener.postMessage(
                                { "type": 'tfr.sh', hash: hash, url: ['https://', location.host, '/t/', ws_id, '/'].join('') },
                                '*'
                            );
                        }, 500)
                    }

                    let paths = location.pathname.split('/').filter(r => r);
                    let is_history = true;
                    switch (paths[0]) {
                        case 't':
                            fri_id = paths[1] || '';
                            break;
                        case 'a':
                            localStorage.setItem('distributor', paths[1]);
                            break;
                        case 'p':
                            paths.splice(0, 1);
                            if (paths.length > 0) {
                                is_history = false;
                                start_totp(paths)
                            }
                            break;
                    }
                    is_history ? history.replaceState({}, "", '/') : 0;

                    document.querySelectorAll("*[data-key]").forEach(r => {
                        switch (r.getAttribute("data-key")) {
                            case "tfr-key":
                                r.textContent = ws_id;
                                break;
                            case "tfr-host":
                                r.textContent = location.host;
                                break;
                        }
                    });
                    tfr_sh_url = ['eval "$(curl -s https://', location.host, '/t/', ws_id, ')"'].join('');
                    fri_ids = JSON.parse(localStorage.getItem("Friend") || '{}') || {};
                    if (fri_id != ws_id) {
                        view_fri_File(fri_id);
                    }
                    document.querySelector('#viewSource').href = ['https://', location.host, '/t/', ws_id].join('');
                }
                break;
            case 'Unauthorized':
                UMC.UI.On('Login');
                break;
            case 'DataExhausted':
                showToast({ zh: '你的流量已经使用完了，请充值', en: 'Data exhausted. Please recharge' })
                break;
            case 'down':
                if (msg.down) {
                    msg.ecdh ? download_show(msg) :
                        window.open(msg.down, "_self")
                } else {
                    xterm_tfr();
                }
                break;
            case 'totp':
                clearTimeout(heartbeat_time_id);
                if (msg.success) {
                    setting_totp_coded(msg);
                } else if (msg.auth) {
                    setting_totp_code(msg);
                } else {
                    showToast({ zh: '验证不通过', en: 'Validation failed.' });
                    resetCodeInput();
                }
                break;
            case 'heartbeat':
                clearTimeout(heartbeat_time_id);
                if (msg.auth) {
                    setting_totp_code(msg);
                } else {
                    show_totp(msg)
                }
                break;
            case 'text':
                textShow(msg);
                break;
            case 'receive':
                receiveFileDown(msg.ws, msg.receive);
                break;
            case 'files':
                renderUserFileList(msg);
                break;
            case 'view':
                sendFileView(msg.view);
                break;
            case 'tfr':
                sendTfrFile(msg.tfr);
                break;
            case "range":
                range_file(msg);
                break;
            case 'file':
                sendTextFile(msg);
                break;
            case "msg":
                showToast(msg.msg);
                break;
            case "stop":
                is_ws_stop = true;
                break;
            default:
                if (Array.isArray(msg)) {
                    msg.forEach((v) => {
                        let fn = msgFN[v.type] || function () { }
                        fn(v);
                    });
                } else {

                    let fn = msgFN[msg.type] || function () { }
                    fn(msg);
                }
                break;
        }
    }
}
let is_ws_stop = false;
async function fetch_ws() {
    try {
        const res = await fetch('/UMC.WS/', {
            method: 'GET',
            headers: { "X-Connection": "Keep-Alive", 'X-Distributor': localStorage.getItem('distributor') || 'default' } // 传入 header
        });

        updateWsStatus(true);
        const reader = res.body
            .getReader();

        let buffer = new Uint8Array(0);
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const newBuffer = new Uint8Array(buffer.length + value.length);
            newBuffer.set(buffer);
            newBuffer.set(value, buffer.length);
            buffer = newBuffer;

            while (true) {
                if (buffer.length < 3) {
                    break;
                }

                const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.length);
                const length = dataView.getUint16(1, false); // false = 大端
                const type = dataView.getUint8(0);
                const totalPacketSize = 3 + length;

                // 3. 不够一个完整包 → 等待
                if (buffer.length < totalPacketSize) {
                    break;
                }

                // 4. 取出完整包数据
                const data = buffer.slice(3, totalPacketSize);

                // 5. 处理消息
                handleMessage(type, data);

                // 6. 移除已解析的数据
                buffer = buffer.slice(totalPacketSize);
            }
        }
    } catch {
    }
    updateWsStatus(false);
    if (is_ws_stop == false) {
        setTimeout(function () {
            fetch_ws();
        }, 1000);
    }

}
function handleMessage(type, data) {
    switch (type) {
        case 0:
            data = new TextDecoder().decode(data);
            try {
                message(JSON.parse(data))
            } catch {
            }
            // 处理类型0的消息
            break;
        case 1:
            // 处理类型1的消息
            break;
        // 其他类型的消息处理
    }
}
const ws_status_lang = {
    Connected: {
        zh: '已连接',
        en: 'Connected'
    }, Disconnected: {
        zh: '断开 · 自动重连中',
        en: 'Disconnected · Reconnecting...'
    }, Terminate: {
        zh: '主动断开',
        en: 'Terminate the connection'
    }, NoFile: {
        zh: '暂未选择文件',
        en: 'No files selected'
    }, Copied: {
        zh: '已复制',
        en: 'Copied!'
    }, dragleave: {
        zh: '支持拖拽 / 选择文件 / 选择目录',
        en: 'Support Drag & Drop / Files / Folders'
    }, dragover: {
        zh: '放手即刻开始传输',
        en: 'Release to start transfer'
    },
    LoggedIn: {
        en: 'Logged In 👤',
        zh: '已登录 👤',
    },
    NotLogged: {
        en: 'Not logged in 🚫',
        zh: '未登录 🚫',
    }
}
function showToast(msgObj, duration = 3000) {
    const toast = document.getElementById('tfr-toast');
    const textEl = document.getElementById('toast-text');
    const iconEl = toast.querySelector('.toast-icon');
    const isEn = document.body.classList.contains('lang-en');

    // 1. 设置内容与图标
    iconEl.innerText = msgObj.icon || '💡';

    // 2. 同步更新 data 属性，防止用户在提示显示时切换语言导致文案回滚
    textEl.setAttribute('data-zh', msgObj.zh);
    textEl.setAttribute('data-en', msgObj.en);

    // 3. 根据当前语言展示
    textEl.innerText = isEn ? msgObj.en : msgObj.zh;

    // 4. 执行显示动画
    toast.classList.add('show');

    // 5. 定时自动隐藏
    if (window.toastTimer) clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}
/**
 * 核心复制函数
 * @param {string} text - 要复制的文本内容
 * @param {string} successZh - 成功时的中文提示
 * @param {string} successEn - 成功时的英文提示
 */
async function copyToClipboard(text, successZh = "已成功复制到剪贴板", successEn = "Copied to clipboard") {
    try {
        // 1. 尝试现代 API
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            // 2. 回退到传统方案 (创建临时 input)
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed"; // 避免页面跳动
            textArea.style.left = "-9999px";
            textArea.style.top = "10px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }

        showToast({
            zh: successZh,
            en: successEn,
            // icon: '✔️'
        });
    } catch (err) {
        // console.error('复制失败:', err); 
        showToast({ zh: '复制失败，请手动选择', en: 'Copy failed, please select manually', icon: '❌' });

    }
}
function getBrowserLang() {
    const lang = navigator.languages ? navigator.languages[0] :
        (navigator.language || navigator.userLanguage);
    return lang.split('-')[0];
}

function lang_str(zh, en) {
    return (localStorage.getItem('lang_pref') || getBrowserLang()) == 'en' ? en : zh;
}
function lang_pref(t, zh, en) {
    switch (localStorage.getItem('lang_pref') || 'zh') {
        case 'en':
            t.setAttribute('data-en', zh);
            t.innerHTML = en;
            break
        default:
            t.setAttribute('data-en', en)
            t.innerHTML = zh;
            break;
    }

}
function change_lang(t, key, lang) {
    let ng = lang || ws_status_lang;
    switch (localStorage.getItem('lang_pref') || 'zh') {
        case 'en':
            t.setAttribute('data-en', ng[key].zh)
            t.innerHTML = ng[key].en;
            break;
        default:
            t.setAttribute('data-en', ng[key].en)
            t.innerHTML = ng[key].zh;
            break;
    }

}
// 更新状态
function updateWsStatus(ok) {
    const s = document.getElementById("wsStatus");
    const t = document.getElementById("wsText");
    if (ok) {
        s.className = "ws-status ws-connected";
        change_lang(t, "Connected", ws_status_lang);
    } else {
        s.className = "ws-status ws-disconnected";

        change_lang(t, is_ws_stop ? 'Terminate' : "Disconnected", ws_status_lang);
    }
}
async function view_fri_File(f) {
    if (f) {
        const res = await fetch(`/UMC.WS/${f}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: 'view', view: ws_id })
        });
        if (!res.ok) {
            showToast({ zh: '好友不在线', en: 'Friend is offline.' });
        }
    }
}
async function sendTextFile(msg) {
    let tfr = msg.tfr;
    let textarea = document.querySelector('#t' + tfr + 'Panel textarea');
    if (textarea) {
        let w = createWritableStream();

        uploadWithFetch(['/t/', ws_id, '/tmp.txt?tfr=', tfr].join(''), w.stream);
        w.write(textarea.value);
        w.close();

        showToast({ zh: textarea.title + '此文件已经被拉取', en: textarea.title + ' has been fetched' });
        textarea.parentElement.classList.remove("change");
    } else {
        const list = [];
        localTreeView.querySelectorAll(`.file input`).forEach(cb => {
            const f = cb.closest(".tfr-row").__file__;
            if (f && f.path == msg.file) list.push(f);
        });
        if (list.length > 0) {
            await uploadWithFetch(['/t/', ws_id, '/tmp.txt?tfr=', tfr].join(''), list[0].file.stream());
            showToast({ zh: `好友正在获取 ${list[0].path} 文件`, en: `Friend is fetching ${list[0].path}` });
        } else {
            await fetch(['/t/', ws_id, '/?tfr=', tfr].join(''), { method: 'DELETE' });

            showToast({ zh: '您未有打开此文件', en: 'No file currently opened' });
        }
    }

}
async function sendTfrFile(tfr) {
    const files = getSelectedFiles('local');
    if (files.length === 0) {
        fetch(['/t/', ws_id, '/?tfr=', tfr].join(''), { method: 'DELETE' }).then(r => {
            if (r.ok) {
                showToast({ zh: '未有准备拉取的文件', en: 'No files ready for fetch' });
            }
        });
        return;
    }

    const names = files.map(f => ({ file: f.file, path: f.path }));
    var urlKey = [location.origin, 't', ws_id, new Date().getTime(), 'itme.tar.gz'].join('/');
    const tarStream = createTarStream(names);
    const finalStream = tarStream.pipeThrough(new CompressionStream("gzip"));

    await uploadWithFetch([urlKey, '?tfr=', tfr].join(''), finalStream);

    showToast({ zh: '选中的文件已经被拉取', en: ' Selected files have been fetched' });
}
async function receiveFileDown(wsid, files) {
    const send_files = [];
    localTreeView.querySelectorAll(' .file input').forEach(cb => {
        const f = cb.closest(".tfr-row").__file__;
        if (f && files.indexOf(f.path) > -1) send_files.push(f);
    });
    if (send_files.length > 0) {

        showToast({ zh: `好友正在获取 ${send_files.length} 个文件`, en: `Friend is fetching ${send_files.length} files ...` });
        var urlKey = [location.origin, 't', ws_id, new Date().getTime(), 'itme.tar.gz?wid=' + wsid].join('/');
        const tarStream = createTarStream(send_files);
        const finalStream = tarStream.pipeThrough(new CompressionStream("gzip"));
        await uploadWithFetch(urlKey, finalStream);
    } else {
        const res = await fetch(`/UMC.WS/${wsid}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: 'msg', msg: lang_str("好友未准备文件", "Friend has no files ready") })
        });
        await sendFileView(wsid);
    }
}

async function sendFileViewAll() {
    const list = [];
    localTreeView.querySelectorAll(` .file input`).forEach(cb => {
        const f = cb.closest(".tfr-row").__file__;
        if (f) list.push({
            file: f.path,
            name: f.file?.name || f.name,
            size: f.file?.size || f.size
        });
    });
    for (var k in fri_ids) {
        const res = await fetch(`/UMC.WS/${k}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: 'files', ws: ws_id, files: list })
        });
    }
}
async function sendFileView(wsid) {
    fri_ids[wsid] = true;

    localStorage.setItem("Friend", JSON.stringify(fri_ids));
    const list = [];
    localTreeView.querySelectorAll(` .file input`).forEach(cb => {
        const f = cb.closest(".tfr-row").__file__;
        if (f) list.push({
            file: f.path,
            name: f.file?.name || f.name,
            size: f.file?.size || f.size
        });
    });
    const res = await fetch(`/UMC.WS/${wsid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: 'files', ws: ws_id, files: list })
    });
}
//switchTab
// 获取选中文件（区分本地/用户）
function getSelectedFiles(type) {
    const list = [];
    const treeViewId = type === 'local' ? 'localTreeView' : 'userTreeView';
    document.querySelectorAll(`#${treeViewId} .file input:checked`).forEach(cb => {
        const f = cb.closest(".tfr-row").__file__;
        if (f) list.push(f);
    });
    return list;
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
function toggleLanguage() {
    const nodes = document.querySelectorAll('[data-en]');

    nodes.forEach(node => {
        if (node.matches('input')) {
            const currentHTML = node.placeholder;
            const targetHTML = node.getAttribute('data-en');
            if (targetHTML) {
                node.placeholder = targetHTML;
                node.setAttribute('data-en', currentHTML);
            }

        } else {
            const currentHTML = node.innerHTML.trim();
            const targetHTML = node.getAttribute('data-en');

            if (targetHTML) {
                node.innerHTML = targetHTML;
                node.setAttribute('data-en', currentHTML);
            }
        }
    });


    // 2. 切换 Body 类名，触发 CSS 动画
    const isEn = document.body.classList.toggle('lang-en');

    // 3. 持久化存储
    localStorage.setItem('lang_pref', isEn ? 'en' : 'zh');
}
UMC(($) => {
    const DB_NAME = "NodeDB";
    const DB_STORE = "nodeList";
    let db = null;

    // 打开/创建数据库
    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = e => {
                db = e.target.result;
                // 创建仓库，主键 id
                const store = db.createObjectStore(DB_STORE, { keyPath: "id" });
                store.createIndex("name", "name", { unique: false });
            };
            req.onsuccess = e => {
                db = e.target.result;
                resolve(db);
            };
            req.onerror = e => reject(e);
        });
    }

    // 增改
    function saveNode(item) {
        return new Promise(resolve => {
            const tx = db.transaction(DB_STORE, "readwrite");
            tx.objectStore(DB_STORE).put(item);
            tx.oncomplete = resolve;
        });
    }

    // 删除
    function deleteNode(id) {
        return new Promise(resolve => {
            const tx = db.transaction(DB_STORE, "readwrite");
            tx.objectStore(DB_STORE).delete(id);
            tx.oncomplete = resolve;
        });
    }
    // 新增一条节点
    function addNode(item) {
        return new Promise(resolve => {
            const tx = db.transaction(DB_STORE, "readwrite");
            const store = tx.objectStore(DB_STORE);
            store.put(item);
            tx.oncomplete = () => resolve();
        });
    }

    // 获取所有节点
    function getAllNodes() {
        return new Promise(resolve => {
            const tx = db.transaction(DB_STORE, "readonly");
            const store = tx.objectStore(DB_STORE);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
        });
    }

    // ===================== 2. 下拉列表渲染 + 搜索逻辑 =====================
    const input = document.querySelector('.search-input');
    const list = document.getElementById('optionList');

    // 初始化默认节点数据（首次打开自动写入本地库）
    async function initDefaultData() {
        await openDB();
        renderList();
    }

    // 渲染列表到页面
    async function renderList() {
        const nodes = await getAllNodes();
        list.innerHTML = "";
        nodes.forEach(item => {
            const li = document.createElement("li");
            li.dataset.id = item.id;
            li.dataset.val = item.name;
            li.innerText = item.name;
            list.appendChild(li);
        });
        bindItemClick();
    }

    function showList() {
        list.style.display = 'block';
    }
    input.addEventListener('click', showList)

    // 搜索过滤
    input.addEventListener('input', function () {
        const key = this.value.toLowerCase();
        const items = list.querySelectorAll('li');
        items.forEach(item => {
            const text = item.innerText.toLowerCase();
            item.classList.toggle('hide', !text.includes(key));
        });
    });

    // 选中赋值
    function bindItemClick() {
        const items = list.querySelectorAll('li');
        items.forEach(item => {
            item.onclick = function () {
                input.value = this.dataset.val;
                input.focus();
                list.style.display = 'none';
            };
        });
    }

    // 点击空白关闭
    document.addEventListener('click', function (e) {
        if (!document.querySelector('.search-select').contains(e.target)) {
            list.style.display = 'none';
        }
    });

    // 页面初始化
    initDefaultData();
    $.UI.EventUI = 'section.app-main';
    $.UI.Off('Prompt')
        .On("Prompt", function (e, p) {
            showToast({ zh: p.Text, en: p.Text });
        });
    msgFN.Login = (msg) => {
        if (msg.value) {
            UMC.UI.Command("Account", "Login", msg.value);
        } else {
            UMC.UI.API("Account", "Check", "Session");
            login.find('.close').click();
        }
    }
    const login = $('.umc-sub-login');

    login.find('.close').click(function () {
        login.find('.qrcode_view').removeClass('show')
        login.removeClass('show')
    });
    login.find(".qrcode_view .context").click('a,b', function () {
        if ($(this).is('a')) {
            login.find('.close').click();
        } else {
            login.find(".qrcode_view .context").children().remove();
        }
    });
    var func = login.find('.loginFunc').click(function () {
        $(this).parent().cls('showform');
    });
    login.find('form').submit(function () {
        var m = $(this);
        var v = m.val();
        m.parent().is('.showform') ? $.UI.Command('Account', "Login", v) : 0;
        return false;
    });
    var qrcode = new QRCode(login.find("#qrcode").html('')[0], {
        width: 200,
        height: 200
    });
    qrcode.makeImage = function () {
        login.find('#qrcode img').attr({ 'src': 'data:image/gif;base64,R0lGODlhAQABAID/AMDAwAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', style: false });//.attr('style':)
    };
    login.on('qrcode', function (e, qr) {
        var s = qr.scan || {}
        document.body.style.setProperty('--qricon', 'url(' + ((s.icon || qr.icon) || '/css/icon200.jpg') + ')')
        login.find('*[data-key]').each(function () {
            var m = $(this);
            var k = m.attr('data-key');
            m.text(s[k] || qr[k]);
        });
        qrcode.clear();
        qrcode.makeCode(s.url || qr.url);
        func.parent().removeClass('showform');

    });
    $.UI.On("UI.Show", function (e, v) {
        var doc = $(document.createElement("div")).addClass('weui_mask')
            .click(function () {
                $('div[ui].wdk-dialog').addClass('right').removeClass('ui');
            })
            .appendTo(document.body);
        v.on('close', function () {
            doc.remove();
        });


    }).On('Close', function () {
        location.reload(false);
    }).On('User', function (e, v) {
        var n = $('#nodesPanel').addClass('logged');
        if (n.attr('data-init')) {
            n.on('init');
        }
        if (v.Device) {
            let tfr_login = document.querySelector('#tfr_login');

            $(tfr_login).attr('data-alias', v.Alias || false);
            change_lang(tfr_login, "LoggedIn")
        } else {
            location.reload(false);
        }

    }).On('Login', function (e, v) {
        var code = (v || {}).code || 'UMC';
        if (!login.is_check) {
            login.is_check = true;
            $.UI.API('Account', 'Scan', { _: 'wx', 'type': code }, function (scan) {
                login.is_check = false;
                login.addClass('show')
                requestAnimationFrame(function () {
                    login.find('.qrcode_view').addClass('show');
                });
                login.find(".qrcode_view .context").children().remove();
                login.on('qrcode', scan.scan);
            });
        }
    });

    $.UI.Command("Account", "Self", localStorage.getItem('distributor') || "Info", function (xhr) {
        $.UI.Device = xhr.Device;
        if (xhr.Name) {
            $.UI.On('User', xhr);
        }
    });


    const codeInputs = document.querySelectorAll('.code-input');
    const keyBtns = document.querySelectorAll('.key-btn[data-num]');
    const deleteBtn = document.querySelector('.key-btn.delete');
    const qr_codeDiv = document.querySelector('.verify-container .qrcode');
    const nodesPanel = UMC('#nodesPanel');//document.querySelector('#nodesPanel');
    nodesPanel.on('init', function () {
        UMC.UI.On('Platform.Node');
    });

    const nodeContainer = document.getElementById('nodes-list-container');
    UMC(nodeContainer).click(".btn-primary", function (e) {
        start_totp(e.target.closest('.node-card').dataset.name.split('/'));
    }).on('change', function (e) {
        let node = e.target.closest('.node-card');
        UMC.UI.Command('Platform', "Node", { __: node.dataset.name + (e.target.checked ? '/Audited' : '/UnAudit') });
    });
    function nodeElement(x) {
        const newCard = document.createElement('div');
        newCard.className = 'node-card';
        newCard.dataset.name = x.Name;
        let status = x.OnLine ? 'online' : 'offline';
        newCard.setAttribute('data-status', status);
        let OnLine = x.OnLine ? lang_str('在线', 'Online') : lang_str('离线', 'Offline');
        let btn_attr = x.OnLine ? '' : 'style="background:#6c757d; cursor:not-allowed;" disabled ';
        let input_attr = x.OnLine ? '' : ' disabled ';
        let btn_txt = x.OnLine ? lang_str('打开终端 (Web Shell)', 'Open Web Shell') : lang_str('设备离线', 'Device Offline');
        let checkText = x.IsAudit ? "checked" : "";
        let UnitsOwned = x.UnitsOwned == 0 ? lang_str('弹性配额', 'Elastic Quota') : [lang_str('锁定', 'Locking '), ` ${x.UnitsOwned}`, lang_str('-Month Quota', '个月配额')].join('');
        let next_billing = x.IsTrial ? lang_str("试用截止日", 'Trial Expiration Date') : lang_str('配额续期日', 'Next Renewal');
        // data-en="Release Node"
        newCard.innerHTML = `
            <div class="node-card-header">
                <div class="node-title-group">
                    <a model="Platform" cmd="Node" send="${x.Key}/Subject" class="node-name">${x.Subject}</a>
                    <a model="Platform" cmd="Node" send="${x.Key}/UnitsOwned"  class="node-badge">${UnitsOwned}</a>
                </div>
                <div class="node-meta-group">
                    <span class="next-billing-tag">⏳ ${next_billing}：${x.NextTime}</span>
                    <span class="status-${status}">● ${OnLine}</span>
                    <button class="btn-outline-danger"  model="Platform" cmd="Node" send="${x.Key}/Release" >${lang_str('注销节点', 'Release Node')}</button>
                </div>
            </div>
            <div class="action-container">
                <div class="webshell-box">
                    <span class="webshell-url">URL: https://${location.hostname}/p/${x.Name}</span>
                     <div>  <button class="btn-primary" ${btn_attr}>⚡ ${btn_txt}</button>
                                            <div class="audit-control-box">
                            <span class="audit-label">${lang_str('全量审计', 'Full Audit')}</span>
                            <label class="switch">
                                <input type="checkbox" ${checkText} ${input_attr} >
                                <span class="slider"></span>
                            </label>
                        </div>
                        </div>
                </div>
            </div>`;
        return newCard
    }
    const search_input = UMC('#node-search-input');
    const statusSlt = UMC('#node-status-filter');//.value;
    function filterNodes() {
        const keyword = search_input.val();//document.getElementById('node-search-input').value.toLowerCase().trim();
        const statusFilter = statusSlt.val();
        const cards = nodeContainer.querySelectorAll('.node-card');
        let visibleCount = 0;

        cards.forEach(card => {
            const name = card.querySelector('.node-name').innerText.toLowerCase();
            const url = card.querySelector('.webshell-url').innerText.toLowerCase();
            const status = card.getAttribute('data-status');

            const matchesKeyword = name.includes(keyword) || url.includes(keyword);
            const matchesStatus = (statusFilter === 'all') || (status === statusFilter);

            if (matchesKeyword && matchesStatus) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        document.getElementById('no-search-results').style.display = (visibleCount === 0 && cards.length > 0) ? 'block' : 'none';
    }

    search_input.on('input', filterNodes);

    statusSlt.on('change', filterNodes);

    UMC.UI.On('Platform.Node', function (e, data) {
        if (data && data.model) {
            switch (data.model) {
                case 'view':
                    nodeContainer.replaceChild(nodeElement(data.value), nodeContainer.querySelector('.node-card[data-name="' + data.value.Name + '"]'))
                    break;
                case "del":
                    nodeContainer.querySelector('.node-card[data-name="' + data.value.Name + '"]').remove();
                    break;
                case 'insert':
                    nodeContainer.prepend(nodeElement(data.value));//, nodeContainer.firstChild);
                    break;
            }

        } else {
            UMC.UI.Command('Platform', "Node", xhr => {
                nodeContainer.innerHTML = '';
                UMC('#total-count').text(xhr.Total + '');
                UMC('#used-count').text(xhr.UnitsOwned + '');
                UMC('#renewal-Period').text(xhr.RenewalPeriod);

                xhr.data.forEach(function (x) {
                    nodeContainer.appendChild(nodeElement(x));
                });
            })
        }
    });
    qr_codeDiv
        .addEventListener('click', function () {
            copyToClipboard(qr_codeDiv.dataset.totp);
        })
    document.querySelector('.verify-container .close')
        .addEventListener('click', function () {
            document.querySelector('.verify-container').classList.toggle('show');
        })
    document.querySelector('.key-btn.webauthn').addEventListener('click', function () {
        const msg = deleteBtn.msg;
        let key = deleteBtn.device;
        let webauthn = [];
        switch (msg.key) {
            case '':
            case 'sh':
            case 'bash':
                webauthn = webauthn.concat(JSON.parse(localStorage.getItem(key) || '[]'));
                break;
            default:
                webauthn = webauthn.concat(JSON.parse(localStorage.getItem(key) || '[]'))
                    .concat(JSON.parse(localStorage.getItem(key + '/' + msg.key) || '[]'));
                break;
        }
        if (webauthn.length > 0) {
            WebAuthn(msg, webauthn)
        } else {
            showToast({ zh: "此设备未注册凭证。", en: "This device has no available credentials" });
        }

    });
    let currentIndex = 0;

    keyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentIndex < 6) {
                codeInputs[currentIndex].value = btn.dataset.num;
                moveToNext();
            }
        });
    });

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
    window.show_totp = async function (msg) {

        deleteBtn.msg = msg;
        if (msg.pub) {
            deleteBtn.setAttribute('pub', msg.pub)
        } else {
            deleteBtn.removeAttribute('pub')
        }
        deleteBtn.closest('.verify-container').classList.add('show');
        resetCodeInput();

    }
    window.start_totp = function (paths) {
        delete deleteBtn.totp;
        delete deleteBtn.secret;
        delete deleteBtn.config;
        delete deleteBtn.webauthn;
        deleteBtn.device = paths[0];
        paths.splice(0, 1);
        deleteBtn.pfx = paths[0] || '';
        deleteBtn.cmds = paths.join(' ');
        UMC.api('Platform', 'Heartbeat', { key: deleteBtn.device, code: 'init', 'url': ['https://', location.host, '/t/', ws_id, '/'].join(''), cmd: deleteBtn.cmds, auth: deleteBtn.pfx }, function (xhr) {
            if (!xhr.exist) {
                showToast({ zh: "无人值守节点不在线", en: "Unattended node disconnected" })
            }
        });
    }
    window.resetCodeInput = resetCodeInput;
    // 检查是否输入完成
    async function checkCodeComplete() {
        let code = Array.from(codeInputs).map(i => i.value).join('');
        if (code.length == 6) {
            var cmd = deleteBtn.cmds;
            var pub_key = deleteBtn.getAttribute('pub');
            if (pub_key) {
                let cmd_value;
                if (deleteBtn.config) {
                    var v = deleteBtn.config;
                    if (deleteBtn.totp) {
                        if (await verifyTOTP(deleteBtn.secret, code)) {
                            if (!v.init) {
                                delete deleteBtn.totp;
                                lang_pref(document.querySelector('.verify-container .title'), "4/4、授权口令验证", "4/4.Authorization Passcode Verification.");
                                let container = deleteBtn.closest('.verify-container');
                                container.classList.remove('init');
                                container.classList.add("show", 'auth');
                                resetCodeInput();
                                return
                            }
                        } else {
                            showToast({ zh: "口令不正确", en: "Incorrect passcode." });
                            return;
                        }
                    }
                    if (deleteBtn.secret) {
                        v.code = code;
                        cmd_value = CBOR.encode([deleteBtn.secret, JSON.stringify(v)])
                    } else {
                        cmd_value = CBOR.encode([code, JSON.stringify(v)]);
                    }
                } else {
                    cmd_value = new TextEncoder().encode(code + cmd);
                }

                const serverIV = generateIV();
                let decrypt = decrypt_data(await deriveSharedAESKey(KEY_PAIR.privateKey, pub_key), serverIV, cmd_value);
                const raw = new Uint8Array(atob(PUB_KEY_B64).split("").map(c => c.charCodeAt(0)));
                const merged = new Uint8Array(raw.length + serverIV.length);
                merged.set(raw);
                merged.set(serverIV, raw.length);
                code = btoa(String.fromCharCode(...new Uint8Array(merged)));
                cmd = btoa(String.fromCharCode(...new Uint8Array(decrypt)));
            }
            UMC.api('Platform', "Heartbeat", { key: deleteBtn.device, code: code, url: ['https://', location.host, '/t/', ws_id, '/'].join(''), cmd: cmd, auth: deleteBtn.pfx })

        }
    }

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
        const time = Math.floor(Date.now() / 1000 / period);
        const timeBuffer = new ArrayBuffer(8);
        const view = new DataView(timeBuffer);
        view.setBigUint64(0, BigInt(time), false);
        const cryptoKey = await crypto.subtle.importKey(
            "raw", secretKey, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
        );
        const signature = await crypto.subtle.sign("HMAC", cryptoKey, timeBuffer);
        const code = getCodeFromSignature(signature, digits);
        return secureCompare(code.toString().padStart(digits, '0'), userInputCode.trim());
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
        // 1. 解码 attestationObject（CBOR）
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
    async function WebAuthn(msg, credentials) {
        let allowCredentials = [];
        credentials.forEach(r => {

            const raw = new Uint8Array(atob(r).split("").map(c => c.charCodeAt(0)));
            allowCredentials.push({
                type: "public-key",
                id: raw,
                transports: ["usb", "nfc", "ble", "internal"]
            })
        });

        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        const timestamp = Math.floor(Date.now() / 1000);
        view.setUint32(0, timestamp, false);
        var challenge = new Uint8Array(buf);
        const loginOpts = {
            challenge: challenge,
            rpId: location.hostname,
            allowCredentials: allowCredentials,
            userVerification: "preferred",
            timeout: 60000
        };
        try {
            const assertion = await navigator.credentials.get({
                publicKey: loginOpts
            });
            const authData = new Uint8Array(assertion.response.authenticatorData);

            const signature = derToRawSignature(assertion.response.signature);

            let cborBuf = CBOR.encode([deleteBtn.cmds, authData, signature, challenge]);
            const serverIV = generateIV();
            let decrypt = decrypt_data(await deriveSharedAESKey(KEY_PAIR.privateKey, msg.pub), serverIV, cborBuf);
            const raw = new Uint8Array(atob(PUB_KEY_B64).split("").map(c => c.charCodeAt(0)));
            const merged = new Uint8Array(raw.length + serverIV.length);
            merged.set(raw);
            merged.set(serverIV, raw.length);


            let code = btoa(String.fromCharCode(...new Uint8Array(merged)));
            let cmd = btoa(String.fromCharCode(...new Uint8Array(decrypt)));

            const clientDataJSON = new TextDecoder("utf-8").decode(assertion.response.clientDataJSON);

            UMC.api('Platform', "Heartbeat", {
                key: deleteBtn.device, code: code, url: ['https://', location.host, '/t/', ws_id, '/'].join(''), cmd: cmd,
                clientDataJSON: clientDataJSON, auth: deleteBtn.pfx
            })

        } catch (e) {
            if (e.name === "NotAllowedError") {
                return false;
            } else {
                showToast({ zh: e.message, en: e.message });
            }
        }
    }

    async function registerWebAuthn(msg, value) {

        try {
            // 1. 生成注册选项
            const options = {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rp: { name: "TFR", id: location.hostname },
                user: {
                    id: crypto.getRandomValues(new Uint8Array(16)),
                    name: [msg.host, msg.key ? ('/' + msg.key) : '', '/', value.alias].join(''),
                    // name: msg.host,
                    displayName: [msg.host, msg.key ? ('/' + msg.key) : '', '/', value.alias].join('')
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
            deleteBtn.secret = pub_key;
            deleteBtn.webauthn = rawId;
            let container = deleteBtn.closest('.verify-container');
            lang_pref(container.querySelector('.title'), "4/4、授权口令", "4/4.Authorization Passcode.");
            container.classList.remove('init');
            container.classList.add("show", 'auth');
        } catch (e) {
            showToast({ zh: e.message, en: e.message });
        }
    }
    window.setting_totp_coded = function (msg) {
        lang_pref(document.querySelector('.verify-container .title'), "动态口令验证", "TOTP Verification");
        deleteBtn.removeAttribute("pub");
        delete deleteBtn.secret;

        if (deleteBtn.webauthn) {
            let key = deleteBtn.device;
            if ((msg.key || '').includes('@'))
                key += '/' + msg.key;

            var vs_value = JSON.parse(localStorage.getItem(key) || '[]');
            vs_value.push(deleteBtn.webauthn);
            localStorage.setItem(key, JSON.stringify(vs_value));
        }
        if (deleteBtn.cmds) {
            var paths = deleteBtn.cmds.split(' ');
            var cmd = paths[0];//.sp;
            if (cmd.includes('@')) {
                addNode({ id: deleteBtn.device + '/' + cmd, name: deleteBtn.device + '/' + paths.join('/') })
            } else if (paths.length > 1) {
                addNode({ id: deleteBtn.device, name: deleteBtn.device + '/' + paths.join('/') })
            } else {
                addNode({ id: deleteBtn.device, name: deleteBtn.device + '/' + paths.join('/') })
            }

        } else {
            addNode({ id: deleteBtn.device, name: deleteBtn.device })
        }
        history.replaceState({}, "", '/');
        document.querySelector('.ws-status form').reset();
        document.querySelector('.verify-container').classList.remove('show', 'init');
        if (msg.auth) {
            showToast({ zh: '设置成功', en: 'configured successfully.' });
        } else {
            showToast({ zh: '终端已打开', en: 'Terminal has been opened.' });
        }
    }
    window.setting_totp_code = function (msg) {
        let login = $(document.querySelector('.verify-container'));
        login[0].classList.remove('show', 'auth', 'init');
        var secret = crypto.getRandomValues(new Uint8Array(8));

        var value = {};
        delete deleteBtn.webauthn;

        if (msg.key) {
            value.key = msg.key;
        }
        if (msg.init) {
            value.init = true;
            lang_pref(login.find('.title')[0], '安全验证初始化', "Security Verification Setup");
            deleteBtn.setAttribute("pub", msg.pub)
            deleteBtn.config = value;
            deleteBtn.totp = true;
            deleteBtn.secret = secret;

            let totp_url = ['otpauth://totp/itme?secret=', base32Encode(secret), '&issuer=', encodeURIComponent(msg.host)].join('')
            var qrcode = new QRCode(qr_codeDiv, {
                width: 200,
                height: 200
            });
            qr_codeDiv.dataset.totp = ['otpauth://totp?secret=', base32Encode(secret)].join('');
            qrcode.makeCode(totp_url);
            login.find('img').css({
                margin: '10px auto',
                border: '1px solid #dcdfe6',
                padding: '10px'
            });

            login.addClass('show init');

            resetCodeInput();
            return false;
        } else {
            var dg = $.UI.Confirm(lang_str('1/4、添加安全认证', "1/4.Add Security Authentication"), '', function (v) {
                dg.on('close');
                value.alias = v.alias;
                deleteBtn.secret = secret;
                deleteBtn.setAttribute("pub", msg.pub)
                deleteBtn.config = value;
                $.UI.Sheet(lang_str('2/4、认证模式', '2/4.Authentication Mode'), [{ text: lang_str('动态口令（人员）', 'Adopt TOTP') }, { text: lang_str('网页凭证（设备）', 'Adopt WebAuthn') }], function (e, i) {
                    switch (i) {
                        case 0:
                            deleteBtn.totp = true;
                            lang_pref(login.find('.title')[0], "3/4、设置动态口令", "3/4.Set Up TOTP");
                            let totp_url = ['otpauth://totp/', encodeURIComponent(value.alias), '?secret=', base32Encode(secret), '&issuer=', encodeURIComponent(msg.host + (msg.key ? ('/' + msg.key) : ''))].join('')
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
                            registerWebAuthn(msg, value)
                            break;
                    }
                });


                return false;
            }).attr('ui', 'Confirm').addClass('not');

            var bd = dg.find('.weui_dialog_bd');
            UMC({ tag: 'input', cls: 'el-input__inner lang-node', name: 'alias', placeholder: lang_str("认证别名", "Authentication Alias") }).appendTo(bd);

        }
    }


    // 重置
    function resetCodeInput() {
        codeInputs.forEach(i => i.value = '');
        currentIndex = 0;
        codeInputs[0].focus();
    }

    function loadStreamSaver() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            // 优先国内镜像
            script.src = '/js/StreamSaver.js';
            script.onload = () => {
                streamSaver.mitm = '/js/mitm.html';
                resolve();
            };
            document.head.appendChild(script);
        });
    }
    loadStreamSaver().then(() => {
    });
    const savedLang = localStorage.getItem('lang_pref');
    if (savedLang === 'en' || (!savedLang && navigator.language.startsWith('en'))) {
        if (!document.body.classList.contains('lang-en')) {
            toggleLanguage();
        }
    }

    fetch_ws();

    const localTreeView = document.getElementById('localTreeView');
    const fileInput = document.getElementById('fileInput');
    const dirInput = document.getElementById('dirInput');
    const userTreeView = document.getElementById('userTreeView');
    let allLocalNodes = [];

    const btn_slt_file = document.querySelector('#slt_files')
    btn_slt_file.addEventListener('click', function (pe) {
        if (pe.altKey || pe.metaKey || pe.ctrlKey) {
            fileInput.setAttribute("mode", "exe");
        } else {
            fileInput.removeAttribute("mode")
        }
        fileInput.click();
    });
    document.addEventListener('keydown', (e) => {
        if (e.altKey || e.metaKey || e.ctrlKey) {
            if (check_xterm()) {
                lang_pref(btn_slt_file, "选择程序", "Select & Make Executable");
                btn_slt_file.is_app = true;
            }
        }
    })
    document.addEventListener('keyup', (e) => {
        if (btn_slt_file.is_app) {
            btn_slt_file.is_app = false;
            lang_pref(btn_slt_file, "选择文件", "Select Files");

        }
    })
    window.triggerDir = () => { dirInput.click(); }
    // 选项卡
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab)
            // document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            // document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            // tab.classList.add('active');
            // document.getElementById(`${tab.dataset.tab}Panel`).classList.add('active');
        });
    });
    const dropZone = document.getElementById('dropZone');
    const mainText = document.getElementById('mainText');
    document.querySelector('.ws-status form')
        .addEventListener("submit", function (e) {
            e.preventDefault();
            var l = this.querySelector('input').value;
            var key = ["https://", location.host, "/p/"].join('')
            if (l.startsWith(key)) {
                var ps = l.substring(key.length).split('/').filter(r => r);
                if (ps.length > 0) {
                    start_totp(ps);
                    return
                }
            } else {
                var ps = l.split('/').filter(r => r);
                if (ps.length > 0) {
                    start_totp(ps);
                    return
                }
            }
            showToast({ zh: '输入的终端网址格式不正确', en: 'The terminal URL you entered is invalid.' });
        });
    document.querySelectorAll('#copyFriends').forEach(tab => {

        tab.addEventListener('click', async () => {
            await copyToClipboard(["https://", location.host, "/t/", ws_id + '/'].join(""));
        });

    });
    document.querySelectorAll('#handleShare').forEach(tab => {

        tab.addEventListener('click', async () => {
            var text = [];
            text.push(lang_str('TFR - 流盲传输', 'TFR - Transfer Files Privately'));
            text.push(lang_str('我正在使用流盲传输来无痕盲中继来分享文件，点击链接即可下载我分享的文件。', 'I am using TFR to share files privately. Click the link to download the files I shared.'));
            text.push(["https://", location.host, "/t/", ws_id + '/'].join(""));
            text.join('\n');
            copyToClipboard(text.join('\n'))
        });

    });
    document.querySelectorAll('#copyTerm').forEach(tab => {
        tab.addEventListener('click', async () => {
            await copyToClipboard(tfr_sh_url);
        });
    });
    document.getElementById('dlBtn').addEventListener('click', async () => {
        let downEm = document.querySelector('.download_card');
        let down = downEm.getAttribute("down");
        downEm.removeAttribute("down");
        await downloadWithFetch(down);
    });
    document.getElementById('cancelBtn').addEventListener('click', async () => {
        let downEm = document.querySelector('.download_card');
        let down = downEm.getAttribute("down");
        downEm.removeAttribute("down");
        await fetch(down, { method: 'DELETE' });
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');

            change_lang(mainText, "dragover", ws_status_lang);
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');

            change_lang(mainText, "dragleave", ws_status_lang);
        }, false);
    });

    // 2. 处理文件掉落逻辑
    dropZone.addEventListener('drop', async (e) => {
        const items = e.dataTransfer.items;
        if (!items) return;
        const entries = [];
        for (let item of items) {
            const ent = item.webkitGetAsEntry();
            if (ent) entries.push(ent);
        }
        await parseAndAppendEntries(entries);
        switchTab('local').classList.add('append');
    });
    fileInput.onchange = async (e) => {
        const tfr_id = check_xterm();
        if (tfr_id) {
            const files = []
            for (let f of e.target.files) {
                files.push({ name: f.name, size: f.size, path: f.name, isFile: true, file: f, children: [] });
            }
            if (btn_slt_file.is_app) {
                btn_slt_file.is_app = false;
                lang_pref(btn_slt_file, "选择文件", "Select Files");
            }
            if (files.length > 0) {

                var urlKey = [location.origin, 't', ws_id, new Date().getTime(), (files.length > 1 || fileInput.getAttribute("mode")) ? 'itme.tar.gz' : files[0].file.name].join('/');
                let m = (files.length == 1 && fileInput.getAttribute("mode")) ? 0o755 : false;
                const finalStream = (files.length > 1 || fileInput.getAttribute("mode")) ? createTarStream(files, m).pipeThrough(new CompressionStream("gzip")) : files[0].file.stream();
                xterm_tfr(true);
                await uploadWithFetch([urlKey, '?tfr=' + tfr_id].join(''), finalStream, true);

            }
            fileInput.value = '';
            return
        }
        for (let f of e.target.files) {
            allLocalNodes.push({ name: f.name, size: f.size, path: f.name, isFile: true, file: f, children: [] });
        }
        fileInput.value = '';
        renderLocalTree();
        switchTab('local').classList.add('append');
    };
    function check_xterm() {
        const xte = document.querySelector('.tab-item.active[model=xterm]');
        if (xte) {
            let m = document.querySelector('#' + xte.getAttribute("data-tab") + "Panel #terminal");
            if (!m.classList.contains('lost')) {
                return m.getAttribute("tfr-id")
            }
        }
        return false;
    }
    dirInput.onchange = async (e) => {
        const tfr_id = check_xterm();
        if (tfr_id) {
            const files = []
            for (let f of e.target.files) {
                files.push({ file: f })
            }
            if (files.length > 0) {
                var urlKey = [location.origin, 't', ws_id, new Date().getTime(), 'itme.tar.gz'].join('/')
                const tarStream = createTarStream(files);
                const finalStream = tarStream.pipeThrough(new CompressionStream("gzip"));

                xterm_tfr(true);
                await uploadWithFetch([urlKey, '?tfr=' + tfr_id].join(''), finalStream, true);

            }
            fileInput.value = '';
            return
        }
        const map = {}, root = [];
        for (let f of e.target.files) {
            if (!f.name.startsWith('.')) {
                const paths = f.webkitRelativePath.split('/');
                let currMap = map, currList = root;
                paths.forEach((name, i) => {
                    const isFile = i === paths.length - 1;
                    if (!currMap[name]) {

                        const node = isFile ? { name, path: f.webkitRelativePath, isFile, file: f, size: f.size, children: [] } : { name, path: f.webkitRelativePath, isFile, children: [] };
                        currMap[name] = node;
                        currList.push(node);
                    }
                    if (!isFile) { currList = currMap[name].children; currMap = currMap[name].children; }
                });
            }
        }
        allLocalNodes = [...allLocalNodes, ...root];
        renderLocalTree();
        switchTab('local').classList.add('append');
    };

    document.querySelector(".btn_friend_down").addEventListener("click", async function () {
        const users = getSelectedFiles('user');
        if (users.length > 0) {
            let paths = users.map(r => r.path);
            const res = await fetch(`/UMC.WS/${fri_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: 'receive', ws: ws_id, receive: paths })
            });
        }
    });
    document.querySelectorAll("#master-select").forEach(e => {
        e.addEventListener("click", function () {
            let v = this.getAttribute('for');
            if (v) {
                const cbs = document.getElementById(v).querySelectorAll("input[type='checkbox']");
                const b = this.checked;
                cbs.forEach(c => (c.checked != b) ? c.click() : 0);
            }
        })
    })

    // 解析文件
    async function parseAndAppendEntries(entries) {
        const appendList = [];
        for (let ent of entries) {
            if (ent.isFile) {
                if (!ent.name.startsWith('.')) {
                    const f = await new Promise(r => ent.file(r));
                    appendList.push({ path: ent.fullPath.substring(1), name: ent.name, isFile: true, size: f.size, file: f, children: [] });
                }
            } else {
                const dir = { name: ent.name, isFile: false, children: [] };
                appendList.push(dir);
                const reader = ent.createReader();
                const subs = await new Promise(r => reader.readEntries(r));
                await parseEntries(subs, dir.children);
            }
        }
        allLocalNodes = [...allLocalNodes, ...appendList];
        renderLocalTree();
    }

    async function parseEntries(entries, parent) {
        for (let ent of entries) {
            if (ent.isFile) {
                if (!ent.name.startsWith('.')) {
                    const f = await new Promise(r => ent.file(r));
                    parent.push({ path: ent.fullPath.substring(1), name: ent.name, isFile: true, file: f, children: [] });
                }
            } else {
                const dir = { name: ent.name, isFile: false, children: [] };
                parent.push(dir);
                const reader = ent.createReader();
                const subs = await new Promise(r => reader.readEntries(r));
                await parseEntries(subs, dir.children);
            }
        }
    }

    // 渲染本地树形结构
    function renderLocalTree() {
        localTreeView.innerHTML = '';
        let counter = localTreeView.parentElement.querySelector("#count");
        counter.textContent = '0';

        function build(nodes, parent, level) {
            nodes.forEach(node => {
                const li = document.createElement('div');
                parent.appendChild(li);
                if (node.isFile) {
                    li.className = 'tfr-row file';
                    li.__file__ = node;
                    li.addEventListener('click', function () { toggleSelect(this) });
                    const sizeText = formatFileSize(node?.size);
                    const t = node.file?.lastModified ? new Date(node.file.lastModified).toLocaleString() : '';
                    li.innerHTML = `<input type="checkbox">
                                <span style="font-size: 16px; margin-right: 10px;">📄</span>
                                <div style="flex: 1;">
                                    <div style="font-size: 13px; font-weight: 500;">${node.name}</div>
                                    <div style="font-size: 11px; color: #999;">${sizeText} • ${t}</div>
                                </div>
                                <div class="pipe-tag">IN PIPE</div>`;
                    li.style.paddingLeft = ((48 * level) + 15) + 'px';

                    li.querySelector("input[type='checkbox']").addEventListener('click', function (e) {
                        e.stopPropagation();
                        toggleSelect(this.parentElement, this, counter);
                    });
                } else {

                    li.addEventListener('click', function () { toggleFolder(this) });
                    li.className = 'tfr-row folder ';
                    li.innerHTML = `<input type="checkbox">
                            <span class="arrow">▶</span>
                            <span style="font-size: 18px; margin-right: 10px;">📂</span>
                            <div style="flex: 1;">
                                <div style="font-size: 14px; font-weight: 600;">${node.name}</div>
                                <div style="font-size: 11px; color: #999;">${node.children.length}<span class="lang-node"></span></div>
                            </div>`;

                    li.style.paddingLeft = ((48 * level) + 15) + 'px';

                    lang_pref(li.querySelector('.lang-node'), "个待流传文件", "　files to transfer");
                    li.querySelector("input[type='checkbox']").addEventListener('click', function (e) {
                        e.stopPropagation();
                        toggleSelect(this.parentElement, this);
                        const b = this.checked;
                        const cbs = this.parentElement.nextElementSibling.querySelectorAll("input[type='checkbox']")
                        cbs.forEach(c => (c.checked == b) ? 0 : c.click());

                    });
                    const ul = document.createElement('div');
                    ul.className = 'tfr-child-list';
                    parent.appendChild(ul);
                    build(node.children || [], ul, level + 1);
                }
            });
        }
        build(allLocalNodes, localTreeView, 0);

        sendFileViewAll();
    }

    // 构建用户文件的树形结构（解析路径）
    function buildUserFileTree(files) {
        const root = [];
        const map = {};

        files.forEach(file => {
            // 按路径分割（支持多级目录）
            const paths = file.file.split('/');
            const fileName = paths.pop();
            let currentPath = '';
            let currentMap = map;
            let currentNodes = root;

            // 构建目录结构
            paths.forEach(dirName => {
                currentPath += dirName + '/';
                if (!currentMap[currentPath]) {
                    const dirNode = {
                        name: dirName,
                        path: currentPath,
                        isFile: false,
                        children: []
                    };
                    currentMap[currentPath] = dirNode;
                    currentNodes.push(dirNode);
                }
                currentNodes = currentMap[currentPath].children;
                currentMap = currentMap[currentPath].children;
            });

            // 添加文件节点
            const fileNode = {
                name: fileName,
                path: file.file,
                isFile: true,
                size: file.size,
                name: file.name,
                children: []
            };
            currentNodes.push(fileNode);
        });

        return root;
    }

    // 渲染用户树形结构
    function renderUserTree() {
        userTreeView.innerHTML = '';

        let counter = userTreeView.parentElement.querySelector("#count");
        counter.textContent = '0';

        function build(nodes, parent, level) {
            nodes.forEach(node => {
                const li = document.createElement('div');
                parent.appendChild(li);
                if (node.isFile) {
                    li.className = 'tfr-row file';
                    li.__file__ = node;
                    li.addEventListener('click', function () { toggleSelect(this) });
                    const sizeText = formatFileSize(node?.size);
                    li.innerHTML = `<input type="checkbox">
                                <span style="font-size: 16px; margin-right: 10px;">📄</span>
                                <div style="flex: 1;">
                                    <div style="font-size: 13px; font-weight: 500;">${node.name}</div>
                                    <div style="font-size: 11px; color: #999;">${sizeText}</div>
                                </div>
                                <div class="pipe-tag">OUT PIPE</div>`;
                    li.style.paddingLeft = ((48 * level) + 15) + 'px';

                    li.querySelector("input[type='checkbox']").addEventListener('click', function (e) {
                        e.stopPropagation();
                        toggleSelect(this.parentElement, this, counter);
                    });
                } else {

                    li.addEventListener('click', function () { toggleFolder(this) });
                    li.className = 'tfr-row folder ';
                    li.innerHTML = `<input type="checkbox">
                            <span class="arrow">▶</span>
                            <span style="font-size: 18px; margin-right: 10px;">📂</span>
                            <div style="flex: 1;">
                                <div style="font-size: 14px; font-weight: 600;">${node.name}</div>
                                <div style="font-size: 11px; color: #999;">${node.children.length} <span class="lang-node"></span></div>
                            </div>`;

                    li.style.paddingLeft = ((48 * level) + 15) + 'px';
                    lang_pref(li.querySelector('.lang-node'), "个可下载文件", "　files available");
                    li.querySelector("input[type='checkbox']").addEventListener('click', function (e) {
                        e.stopPropagation();
                        toggleSelect(this.parentElement, this);
                        const b = this.checked;
                        const cbs = this.parentElement.nextElementSibling.querySelectorAll("input[type='checkbox']")
                        cbs.forEach(c => (c.checked == b) ? 0 : c.click());

                    });
                    const ul = document.createElement('div');
                    ul.className = 'tfr-child-list';
                    parent.appendChild(ul);
                    build(node.children || [], ul, level + 1);
                }
            });
        }
        build(userFileNodes, userTreeView, 0);
    }

    // 外部文件渲染（改为树形）
    window.renderUserFileList = async (msg) => {
        if (msg.ws == fri_id) {
            let files = msg.files;
            if (!files?.length) {
                userFileNodes = [];
                renderUserTree();
                return;
            }
            // 构建树形结构
            userFileNodes = buildUserFileTree(files);
            renderUserTree();
            let tab = switchTab('user');
            tab.classList.add('append');
        } else {
            const res = await fetch(`/UMC.WS/${msg.ws}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: 'RFriend', ws: ws_id })
            });
        }
    };
});
function switchTab(tab) {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const active = document.querySelector(`[data-tab="${tab}"]`);//.classList.add('active');
    active.classList.add('active'); active.classList.remove('hide');
    const panel = document.getElementById(`${tab}Panel`);
    panel.classList.add('active');
    if (!panel.dataset.init) {
        panel.dataset.init = true;
        UMC(panel).on('init');
    }
    return panel;
}

function createWritableStream() {
    let controller;

    const stream = new ReadableStream({
        start(c) {
            controller = c;
        }
    });
    const text = new TextEncoder();
    return {
        stream,
        write: (chunk) => {
            try {
                controller.enqueue(text.encode(chunk));
                return true
            } catch {
                return false;
            }
        },
        close: () => {
            try { controller.close() } catch { }
        } // 结束流
    };
}
function close_tab(t) {
    var me = t || this;
    var tab_e = me.parentElement;
    var tab = tab_e.getAttribute('data-tab');

    if (tab_e.classList.contains('active')) {
        switchTab('intro');
    }
    tab_e.remove();
    document.getElementById(tab + 'Panel').remove();
}

async function textShow(cfn) {
    const down_url = cfn.down;
    const key = "t" + cfn.key;
    let panel_check = document.getElementById(key + "Panel");
    if (panel_check) {
        switchTab(key);
        panel_check.querySelector("textarea").value = await decryptRespText(down_url);// await res.text();

        showToast({ zh: "重新打开" + cfn.title + '文件', en: "Reopen " + cfn.title });
        return;

    }
    const item = document.createElement("div");
    item.classList.add('tab-item');

    item.textContent = cfn.title;
    item.setAttribute('data-tab', key);

    const me = document.createElement("em");
    me.setAttribute('data-icon', '❌');
    me.onclick = (e) => {
        e.stopPropagation(); close_tab(me)
    };

    item.appendChild(me);
    item.setAttribute('data-icon', '📄');

    document.querySelector(".tab-header").appendChild(item);

    const panel = document.createElement("div");
    panel.id = key + "Panel";
    panel.classList.add("tab-panel")
    document.querySelector(".tab-body").appendChild(panel);
    item.addEventListener('click', () => {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        panel.classList.add('active');
    });
    panel.innerHTML = `<div class="tfr-editor-container">
    <div class="tfr-editor-main">
        <div class="editor-body">
            <textarea class="code-textarea" spellcheck="false"></textarea>
        </div>
    </div>
    <div class="tfr-editor-guide">
        <div class="guide-inner">
            <span class="guide-icon">💡</span>
            <p class="guide-text lang-node" >
            </p>
        </div>
    </div>
</div>`;
    lang_pref(panel.querySelector('.lang-node'), `请在终端同一目录执行 <code class='tfr-cmd'>tfr ${cfn.title} -s</code>，即可拉取此文件`, `Run <code class='tfr-cmd'>tfr ${cfn.title} -s</code> in terminal (same directory) fetch this file`);
    switchTab(key);

    const text = await decryptRespText(down_url);
    const textarea = panel.querySelector("textarea");
    textarea.value = text
    textarea.title = cfn.title;
}


function generateShortKey(len = 6) {
    return Math.random().toString(36).substring(2, 2 + len);
}


function xterm_tfr(b) {
    const xte = document.querySelector('.tab-item.active[model=xterm]');
    if (xte) {
        let m = document.querySelector('#' + xte.getAttribute("data-tab") + "Panel #terminal");
        if (!m.classList.contains('lost')) {
            m.write(b ? 'tfr -b\n' : 'tfr\n');
        }
    }
}
async function xterm(msg) {
    const key = "x" + generateShortKey();
    // const title = msg.title;
    const item = document.createElement("div");
    item.classList.add('tab-item');
    item.setAttribute("model", "xterm");
    item.setAttribute('data-icon', '💻')
    item.textContent = msg.host;
    item.title = msg.host;
    item.setAttribute('data-tab', key);

    const me = document.createElement("em");
    me.setAttribute('data-icon', '❌');
    item.appendChild(me);

    document.querySelector(".tab-header").appendChild(item);

    const panel = document.createElement("div");
    panel.id = key + "Panel";
    panel.classList.add("tab-panel")
    document.querySelector(".tab-body").appendChild(panel);
    item.addEventListener('click', () => {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        panel.classList.add('active');
    });
    const terminal = document.createElement("div");
    terminal.id = "terminal";
    terminal.setAttribute("tfr-id", msg.tfr);
    panel.appendChild(terminal);
    const p = document.createElement("div");
    terminal.appendChild(p);
    p.classList.add("close-msg");
    p.classList.add("lang-node");
    lang_pref(p, "连接已断开", "Connection Lost")

    switchTab(key);

    const term = new Terminal({
        cols: 124,
        rows: 28,
        tabStopWidth: 8,
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "Courier New", monospace',
        fontSize: 14,
        lineHeight: 1,
        letterSpacing: 0,
        rendererType: 'dom',
        drawBoldTextInBrightColors: true,

        cursorBlink: true,
        cursorStyle: 'block',
        cursorInactiveStyle: 'outline',

        scrollback: 1000,
        scrollSensitivity: 1,

        theme: {
            background: '#1e1e1e',
            foreground: '#CCCCCC',
            cursor: '#FFFFFF',
            selection: '#424242'
        },

        convertEol: true,
        disableStdin: false,
        allowTransparency: false,
        fastScrollModifier: 'shift',
    });
    term.open(terminal);
    let writer = createWritableStream()
    terminal.write = function (x) {
        term.focus();
        writer.write(x);
    };
    term.onData(data => {
        if (!writer.write((msg.pty == 'RawShell') ? data : data.replace('\r', '\n'))) {
            terminal.classList.add("lost");
        }
    });
    me.onclick = (e) => {
        e.stopPropagation();
        writer.close();
        close_tab(me)
    }
    var start_time = new Date().getTime() / 1000;
    uploadWithFetch(msg.xterm + "/writer", writer.stream, true)
    const res = await fetch(msg.xterm, {
        headers: {
            "X-Public-Key": PUB_KEY_B64
        }
    });

    const reader = await decryptResp(res);

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        term.write(value);
    }
    terminal.classList.add("lost");
    writer.close();
    var end_time = new Date().getTime() / 1000;
    if (end_time - start_time < 2) {
        lang_pref(p, "网络不稳定，请再次尝试", "Network unstable. Please try again.")
    }
}

async function range_file(msg) {
    const list = [];
    localTreeView.querySelectorAll(`.file input`).forEach(cb => {
        const f = cb.closest(".tfr-row").__file__;
        if (f && f.path == msg.file) list.push(f);
    });
    if (list.length > 0) {

        const start = msg.range ? parseInt(msg.range) : 0;
        const blob = list[0].file.slice(start);


        await uploadWithFetch(['/t/', ws_id, '/', msg.file, '?tfr=', msg.tfr].join(''), blob);
        showToast({ zh: `正在恢复 ${list[0].path} 的传输`, en: `Resuming transfer: ${list[0].path}` });
    } else {
        showToast({ zh: `需要在目标终端执行 tfr ${msg.file} -p 来续传文件`, en: `Need to execute tfr ${msg.file} -p in the target terminal` });
    }
}


const CURVE = "P-256";
const AES_ALG = "AES-CTR";
const AES_LEN = 256;
const AES_BLOCK = 16;
let KEY_PAIR;
let PUB_KEY_B64;
async function init_key() {
    KEY_PAIR = await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
    );

    const pubKey = await window.crypto.subtle.exportKey("raw", KEY_PAIR.publicKey);
    PUB_KEY_B64 = btoa(String.fromCharCode(...new Uint8Array(pubKey)));
    // console.log(PUB_KEY_B64)
}
init_key();
async function importServerPublicKey(b64) {
    // console.log("importServerPublicKey", b64)
    const raw = new Uint8Array(atob(b64).split("").map(c => c.charCodeAt(0)));
    return crypto.subtle.importKey("raw", raw, { name: "ECDH", namedCurve: CURVE }, false, []);
}

async function deriveSharedAESKey(privateKey, serverPublicKey) {
    const publicKey = await importServerPublicKey(serverPublicKey);
    const sharedKey = await crypto.subtle.deriveKey(
        { name: "ECDH", public: publicKey },
        privateKey,
        { name: AES_ALG, length: AES_LEN },
        true,
        ["encrypt", "decrypt"]
    );
    const rawKeyBuffer = await crypto.subtle.exportKey("raw", sharedKey);
    return new Uint8Array(rawKeyBuffer)
}


function generateIV() {
    return crypto.getRandomValues(new Uint8Array(16));
}

function processByte(byte, key, iv, state) {
    for (let i = iv.length - 1; i >= 0; i--) {
        iv[i]++;
        if (iv[i] !== 0) break;
    }
    const keyByte = key[state.cursor % key.length];
    const ivByte = iv[state.cursor % iv.length];
    const result = byte ^ keyByte ^ ivByte;

    // 3. 更新游标
    state.cursor++;

    return result;
}


function decrypt_data(key, iv, chunk) {
    const counter = new Uint8Array(iv);
    let state = { cursor: 0 };
    let data = new Uint8Array(chunk);
    for (i = 0; i < data.length; i++) {
        data[i] = processByte(data[i], key, counter, state)
    }
    return data;
}
function createDecryptStream(key, iv) {
    const counter = new Uint8Array(iv);

    // console.log(btoa(String.fromCharCode(...new Uint8Array(key))));
    // console.log(btoa(String.fromCharCode(...new Uint8Array(counter))));
    let state = { cursor: 0 };
    return new TransformStream({
        async transform(chunk, controller) {
            let data = new Uint8Array(chunk);
            for (i = 0; i < data.length; i++) {
                data[i] = processByte(data[i], key, counter, state)
            }
            controller.enqueue(new Uint8Array(data));

        }
    });
}


async function uploadWithFetch(url, stream, is_browser) {
    if (is_ws_stop) {
        showToast({ zh: "当前会话被其它页占用", en: "The current session is occupied by another page." });
    } else {
        let iv = generateIV();
        let res = await fetch(url, {
            method: "PUT",
            headers: {
                // "X-IV": btoa(String.fromCharCode(...new Uint8Array(iv))),
                "Content-Type": "TFR/Public-Key",
                "X-Public-Key": PUB_KEY_B64
            }
        });
        switch (res.status) {
            case 403:
                showToast({ zh: "您的流量已经使用完了，请充值", en: "Your data has run out. Please recharge." });
                return;
            case 401:
                showToast({ zh: "未登录不能上传文件，请登录", en: "You need to log in to upload files." });
                UMC.UI.On("Login")
                return
        }
        const serverPubKeyB64 = res.headers.get("X-Public-Key");
        if (serverPubKeyB64) {

            let encryptTransformer = createDecryptStream(await deriveSharedAESKey(KEY_PAIR.privateKey, serverPubKeyB64), iv);
            const upload = stream.pipeThrough(encryptTransformer);
            await fetch(url, {
                method: "PUT",
                headers: {
                    "X-IV": btoa(String.fromCharCode(...new Uint8Array(iv))),
                    "Content-Type": "TFR/" + (is_browser ? "Browser" : '1.0'),
                    "X-Public-Key": PUB_KEY_B64
                },
                body: upload,
                duplex: "half"
            });
        } else {
            await fetch(url, {
                method: "PUT",
                headers: {
                    "Content-Type": is_browser ? "TFR/Browser" : "application/octet-stream",
                },
                body: stream,
                duplex: "half"
            });
        }
    }
}

async function decryptRespText(url) {
    const res = await fetch(url, {
        headers: {
            "X-Public-Key": PUB_KEY_B64
        }
    });
    const reader = await decryptResp(res);
    let buffer = new Uint8Array(0);
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;
    }
    return new TextDecoder().decode(buffer);
}
async function decryptResp(res) {
    const serverPubKeyB64 = res.headers.get("X-Public-Key");
    if (serverPubKeyB64) {
        let vi = res.headers.get("X-IV");
        const serverIV = new Uint8Array(
            atob(vi).split("").map(c => c.charCodeAt(0))
        );
        let decryptStream = createDecryptStream(await deriveSharedAESKey(KEY_PAIR.privateKey, serverPubKeyB64), serverIV);
        return res.body.pipeThrough(decryptStream).getReader();
    } else {
        return res.body.getReader();
    }
}
function download_show(msg) {
    let down = document.querySelector('.download_card');
    down.setAttribute('down', msg.down);
    down.querySelector('.filesize').textContent = msg.size;
    down.querySelector('.filename').textContent = msg.name;
    let status = down.querySelector('#status');
    let t = 5;
    lang_pref(status, t + "s后下线，将需要重新发起", "Disconnecting in " + t + "s. Re-initiate required.")
    clearInterval(down.time || 0);
    down.time = setInterval(function () {
        t--;
        lang_pref(status, t + "s后下线，将需要重新发起", "Disconnecting in " + t + "s. Re-initiate required.")
        if (t == 1) {
            clearInterval(down.time);
            down.removeAttribute('down');
        }
    }, 1000)


}
async function downloadWithFetch(url) {

    const res = await fetch(url, {
        headers: {
            "X-Public-Key": PUB_KEY_B64,
            "Accept": "TFR/ECDH"
        }
    });

    // 获取响应头
    const contentDisposition = res.headers.get('content-disposition');

    // 解析文件名（和上面逻辑完全一致）
    let fileName = 'default.zip';
    const utf8Match = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
        fileName = decodeURIComponent(utf8Match[1]);
    } else {
        const regularMatch = contentDisposition?.match(/filename="?([^";]+)"?/i);
        fileName = regularMatch ? regularMatch[1] : 'default.zip';
    }

    const fileStream = streamSaver.createWriteStream(fileName, {
        mime: "application/octet-stream"
    });
    const serverPubKeyB64 = res.headers.get("X-Public-Key");

    if (serverPubKeyB64) {
        let vi = res.headers.get("X-IV");
        const serverIV = new Uint8Array(
            atob(vi).split("").map(c => c.charCodeAt(0))
        );
        let decryptStream = createDecryptStream(await deriveSharedAESKey(KEY_PAIR.privateKey, serverPubKeyB64), serverIV);
        return res.body.pipeThrough(decryptStream).pipeTo(fileStream);
    } else {
        return res.body.pipeTo(fileStream);
    }
}

