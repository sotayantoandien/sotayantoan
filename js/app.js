// js/app.js

// 1. Khởi tạo Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(CONFIG.FIREBASE);
}
const auth = firebase.auth();
const db = firebase.firestore();

// 2. Đối tượng App toàn cục
const app = {
    state: { 
        currentUser: null, 
        userProfile: null,
        newsCache: [] // Lưu danh sách tin để không phải tải lại khi xem chi tiết
    },
    
    // --- NAVIGATION LOGIC (CHUYỂN TRANG) ---
    loadPage: async function(pageName) {
        const container = document.getElementById('app-container');
        const mainLayout = document.getElementById('main-layout');
        const mainContent = document.getElementById('main-content');
        
        // Đóng sidebar nếu đang mở (trên mobile)
        const sidebarEl = document.getElementById('sidebarMenu');
        if(sidebarEl) {
            const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebarEl);
            if(bsOffcanvas) bsOffcanvas.hide();
        }

        try {
            // Tải file HTML từ thư mục pages/
            const response = await fetch(`pages/${pageName}.html`);
            if(!response.ok) throw new Error('Page not found');
            const html = await response.text();

            // Xử lý hiển thị
            if (pageName === 'login' || pageName === 'profile') {
                mainLayout.style.display = 'none'; 
                container.innerHTML = html; 
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
                mainLayout.style.display = 'block'; 
                mainContent.innerHTML = html; 
                
                // Gọi hàm khởi tạo dữ liệu riêng cho từng trang
                if(pageName === 'news') app.loadNewsData();
                // Admin không cần init gì đặc biệt vì form đã có sẵn trong HTML
            }
        } catch (error) {
            console.error("Lỗi tải trang:", error);
            alert("Không thể tải trang: " + pageName);
        }
    },

    // --- AUTH (XÁC THỰC) ---
    init: function() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                app.state.currentUser = user;
                await app.checkUserProfile(user);
            } else {
                app.loadPage('login');
            }
        });
    },

    checkUserProfile: async function(user) {
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                app.state.userProfile = doc.data();
                app.updateUI(app.state.userProfile, user);
                
                // Mặc định vào trang News
                // Kiểm tra xem đang ở trang nào, nếu chưa có thì load news
                if(document.getElementById('main-layout').style.display === 'none') {
                    app.loadPage('news');
                }

                // Hiện menu Admin nếu đúng quyền
                if (app.state.userProfile.role === 'admin') {
                    const adminLink = document.getElementById('admin-menu-link');
                    if(adminLink) adminLink.classList.remove('d-none');
                }
            } else {
                app.loadPage('profile');
            }
        } catch (e) {
            console.error(e);
            alert("Lỗi kết nối dữ liệu người dùng!");
        }
    },

    updateUI: function(profile, userAuth) {
        const avatar = userAuth.photoURL || "https://via.placeholder.com/60";
        const headerAvatar = document.getElementById('header-avatar');
        const sidebarAvatar = document.getElementById('sidebar-avatar');
        const sidebarName = document.getElementById('sidebar-name');

        if(headerAvatar) headerAvatar.src = avatar;
        if(sidebarAvatar) sidebarAvatar.src = avatar;
        if(sidebarName) sidebarName.textContent = profile.fullName;
    },

    loginWithGoogle: function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        auth.signInWithPopup(provider).catch(e => alert("Lỗi đăng nhập: " + e.message));
    },

    loginWithEmail: function(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, pass).catch(e => alert("Lỗi: " + e.message));
    },

    saveProfile: async function(e) {
        e.preventDefault();
        const data = {
            email: app.state.currentUser.email,
            fullName: document.getElementById('pf-fullname').value,
            phone: document.getElementById('pf-phone').value,
            workplace: document.getElementById('pf-workplace').value,
            position: document.getElementById('pf-position').value,
            role: 'student', 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await db.collection('users').doc(app.state.currentUser.uid).set(data);
            app.state.userProfile = data;
            app.loadPage('news');
        } catch(err) {
            alert("Lỗi lưu hồ sơ: " + err.message);
        }
    },

    logout: function() {
        auth.signOut();
    },

    // --- DATA FUNCTIONS (NEWS) ---
    loadNewsData: async function() {
        const container = document.getElementById('news-feed');
        if(!container) return;
        
        try {
            const snap = await db.collection('news').orderBy('timestamp', 'desc').limit(20).get();
            if (snap.empty) { container.innerHTML = '<div class="text-center mt-3 text-muted">Chưa có tin tức nào.</div>'; return; }

            app.state.newsCache = []; // Reset cache
            let html = '';
            
            snap.forEach(doc => {
                const d = doc.data();
                d.id = doc.id; // Lưu ID để dùng khi bấm xem chi tiết
                app.state.newsCache.push(d);

                // Xử lý ảnh: Ưu tiên dùng link lh3 từ fileId
                let imgSrc = d.img;
                if(d.fileId) imgSrc = `https://lh3.googleusercontent.com/d/$${d.fileId}`; // Sửa lại template string cho đúng

                const date = d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleDateString('vi-VN') : '';

                html += `
                <div class="card mb-3 shadow-sm border-0 news-card" onclick="app.viewNews('${doc.id}')" style="cursor: pointer;">
                    <div style="height: 200px; background-image: url('${imgSrc}'); background-size: cover; background-position: center;" class="rounded-top position-relative">
                         <span class="badge bg-danger position-absolute top-0 start-0 m-2">Tin mới</span>
                    </div>
                    <div class="card-body">
                        <h5 class="card-title fw-bold text-dark">${d.title}</h5>
                        <p class="card-text text-muted small text-truncate">${d.summary}</p>
                        <small class="text-muted"><i class="far fa-clock me-1"></i> ${date}</small>
                    </div>
                </div>`;
            });
            container.innerHTML = html;
        } catch(e) { 
            console.error(e); 
            container.innerHTML = '<div class="alert alert-danger">Lỗi tải dữ liệu.</div>';
        }
    },

    viewNews: function(id) {
        const item = app.state.newsCache.find(x => x.id === id);
        if (!item) return;
        
        // Gán dữ liệu vào Modal (Modal nằm ở index.html)
        document.getElementById('detail-title').textContent = item.title;
        document.getElementById('detail-content').textContent = item.summary;
        document.getElementById('detail-content').style.whiteSpace = "pre-line"; // Giữ xuống dòng
        
        let imgSrc = item.img;
        if (item.fileId) imgSrc = `https://lh3.googleusercontent.com/d/$${item.fileId}`;
        document.getElementById('detail-img').src = imgSrc;

        // Mở Modal Bootstrap
        const myModal = new bootstrap.Modal(document.getElementById('newsDetailModal'));
        myModal.show();
    },

    // --- ADMIN FUNCTIONS (ĐĂNG BÀI) ---
    
    // 1. Hàm Upload file lên Google Apps Script
    uploadFileToGAS: async function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result.split(',')[1];
                const payload = {
                    base64: base64,
                    mimeType: file.type,
                    filename: file.name
                };

                try {
                    // Gọi đến Script URL từ file config.js
                    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                        method: "POST",
                        body: JSON.stringify(payload)
                    });
                    const result = await response.json();
                    
                    if (result.status === 'success') {
                        resolve(result);
                    } else {
                        reject(result.message);
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = error => reject(error);
        });
    },

    // 2. Xử lý Đăng Tin Tức
    postNews: async function(e) {
        e.preventDefault();
        const title = document.getElementById('adm-news-title').value;
        const summary = document.getElementById('adm-news-summary').value;
        const fileInput = document.getElementById('adm-news-file');

        if(fileInput.files.length === 0) return alert("Vui lòng chọn ảnh minh họa!");

        // Hiện loading overlay
        document.getElementById('upload-overlay').style.display = 'flex';

        try {
            // Bước 1: Upload ảnh
            const uploadResult = await app.uploadFileToGAS(fileInput.files[0]);
            
            // Bước 2: Lưu vào Firestore
            await db.collection('news').add({
                title: title, 
                img: uploadResult.fileUrl, // Link backup
                fileId: uploadResult.fileId, // ID để hiển thị tối ưu
                summary: summary,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            alert("Đăng tin thành công!");
            document.getElementById('admin-news-form').reset();
        } catch (err) { 
            console.error(err);
            alert("Lỗi: " + err); 
        } finally {
            // Tắt loading overlay
            document.getElementById('upload-overlay').style.display = 'none';
        }
    },

    // 3. Xử lý Đăng Tài Liệu
    postDocument: async function(e) {
        e.preventDefault();
        const title = document.getElementById('adm-doc-title').value;
        const category = document.getElementById('adm-doc-cat').value;
        const summary = document.getElementById('adm-doc-summary').value;
        const fileInput = document.getElementById('adm-doc-file');

        if(fileInput.files.length === 0) return alert("Vui lòng chọn file PDF!");

        document.getElementById('upload-overlay').style.display = 'flex';

        try {
            const uploadResult = await app.uploadFileToGAS(fileInput.files[0]);
            
            await db.collection('documents').add({
                title: title,
                category: category,
                summary: summary,
                fileId: uploadResult.fileId,
                viewUrl: uploadResult.viewUrl,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("Lưu tài liệu thành công!");
            document.getElementById('admin-doc-form').reset();
        } catch (err) {
            alert("Lỗi: " + err);
        } finally {
            document.getElementById('upload-overlay').style.display = 'none';
        }
    }
};

// Khởi chạy App
app.init();
