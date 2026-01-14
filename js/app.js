// js/app.js

// 1. Init Firebase
firebase.initializeApp(CONFIG.FIREBASE);
const auth = firebase.auth();
const db = firebase.firestore();

// 2. Global App Object
const app = {
    state: { currentUser: null, userProfile: null },
    
    // --- NAVIGATION LOGIC ---
    loadPage: async function(pageName) {
        const container = document.getElementById('app-container');
        const mainLayout = document.getElementById('main-layout');
        const mainContent = document.getElementById('main-content');
        
        // Đóng sidebar nếu đang mở (trên mobile)
        const sidebarEl = document.getElementById('sidebarMenu');
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebarEl);
        if(bsOffcanvas) bsOffcanvas.hide();

        try {
            // Tải file HTML từ thư mục pages/
            const response = await fetch(`pages/${pageName}.html`);
            if(!response.ok) throw new Error('Page not found');
            const html = await response.text();

            // Xử lý hiển thị
            if (pageName === 'login' || pageName === 'profile') {
                mainLayout.style.display = 'none'; // Ẩn layout chính
                container.innerHTML = html; // Hiện form login full màn hình
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
                mainLayout.style.display = 'block'; // Hiện layout chính
                mainContent.innerHTML = html; // Đổ ruột vào
                
                // Gọi hàm khởi tạo dữ liệu riêng cho từng trang
                if(pageName === 'news') app.loadNewsData();
                if(pageName === 'admin') app.initAdminTabs();
            }
        } catch (error) {
            console.error("Lỗi tải trang:", error);
            alert("Không thể tải trang: " + pageName);
        }
    },

    // --- AUTH ---
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
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            app.state.userProfile = doc.data();
            app.updateUI(app.state.userProfile, user);
            // Mặc định vào trang News
            app.loadPage('news');
            if (app.state.userProfile.role === 'admin') {
                document.getElementById('admin-menu-link').classList.remove('d-none');
            }
        } else {
            app.loadPage('profile');
        }
    },

    updateUI: function(profile, userAuth) {
        const avatar = userAuth.photoURL || "https://via.placeholder.com/60";
        document.getElementById('header-avatar').src = avatar;
        document.getElementById('sidebar-name').textContent = profile.fullName;
        document.getElementById('sidebar-avatar').src = avatar;
    },

    loginWithGoogle: function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        auth.signInWithPopup(provider).catch(e => alert(e.message));
    },

    loginWithEmail: function(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
    },

    logout: function() {
        auth.signOut();
    },

    // --- DATA FUNCTIONS ---
    loadNewsData: async function() {
        const container = document.getElementById('news-feed');
        if(!container) return;
        
        try {
            const snap = await db.collection('news').orderBy('timestamp', 'desc').limit(20).get();
            if (snap.empty) { container.innerHTML = '<div class="text-center mt-3">Chưa có tin.</div>'; return; }

            let html = '';
            snap.forEach(doc => {
                const d = doc.data();
                let imgSrc = d.img;
                if(d.fileId) imgSrc = `https://lh3.googleusercontent.com/d/$${d.fileId}`; // Sửa lại dấu huyền đúng cú pháp JS template literal

                html += `
                <div class="news-card card mb-3 shadow-sm border-0" onclick="app.viewNews('${doc.id}')">
                    <img src="${imgSrc}" class="card-img-top" style="height: 200px; object-fit: cover;">
                    <div class="card-body">
                        <h5 class="card-title fw-bold">${d.title}</h5>
                        <p class="card-text text-truncate">${d.summary}</p>
                    </div>
                </div>`;
            });
            container.innerHTML = html;
            // Lưu data tạm để view chi tiết
            app.state.newsCache = snap;
        } catch(e) { console.error(e); }
    },

    viewNews: function(id) {
        // Tìm trong cache hoặc fetch lại (ở đây tìm cache cho nhanh)
        // ... (Logic view detail tương tự version cũ, nhưng gọi qua app.viewNews)
        alert("Xem chi tiết ID: " + id + " (Logic này bạn copy từ code cũ sang nhé)");
    },

    // --- ADMIN FUNCTIONS ---
    postNews: async function(e) {
        e.preventDefault();
        // Logic upload y hệt version cũ, nhưng gọi qua app.uploadFileToGAS
        alert("Đang xử lý đăng tin... (Copy logic upload từ version 1.8 vào đây)");
    },
    
    // Helper Upload
    uploadFileToGAS: async function(file) {
        // Logic upload y hệt version 1.8
    }
};

// Khởi chạy App
app.init();
