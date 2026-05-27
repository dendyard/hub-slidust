# Slidust

Slidust adalah aplikasi kolaborasi kerja yang menggabungkan project management board, personal workboard, dashboard pelaporan, project notes, dan visual flow editor dalam satu produk. Frontend dibangun dengan React + Vite, memakai `DataContext` sebagai pusat state dan integrasi API.

Dokumen ini merangkum fitur yang ada saat ini di codebase, cara kerja modul utamanya, model permission, dan hal-hal yang membuat Slidust berbeda.

## Ringkasan Produk

Slidust punya 4 area kerja utama:

1. `My Board`
   Satu tempat untuk melihat semua task dan subtask yang ditugaskan ke user lintas project.
2. `Dashboard`
   Ringkasan performa dan aktivitas lintas project yang bisa diakses user.
3. `Project Board`
   Workspace per project dengan banyak mode tampilan: board, list, calendar, roadmap, reporting, dan notes.
4. `Dust Flow`
   Editor flow diagram internal dengan permission owner, editor access, public/private visibility, dan preview card.

## Stack Teknis

- Frontend: React 19, Vite
- Diagram editor: `@xyflow/react`
- Charting: `recharts`
- Rich text editor: `react-quill-new`
- Icons: `lucide-react`
- PWA: `vite-plugin-pwa`
- State/data layer: React Context lewat [src/context/DataContext.jsx](/Applications/MAMP/htdocs/slidust/src/context/DataContext.jsx)

## Arsitektur Singkat

- [src/App.jsx](/Applications/MAMP/htdocs/slidust/src/App.jsx)
  Mengatur shell aplikasi, routing berbasis query string, modal global, dan perpindahan antar halaman.
- [src/context/DataContext.jsx](/Applications/MAMP/htdocs/slidust/src/context/DataContext.jsx)
  Menjadi sumber data utama untuk user, project, task, workflow, note, notification, organization, dan Dust Flow.
- [src/components/layout/Sidebar.jsx](/Applications/MAMP/htdocs/slidust/src/components/layout/Sidebar.jsx)
  Navigasi utama: `My Board`, `Dashboard`, daftar project, dan `Dust Flow`.
- [src/components/layout/Header.jsx](/Applications/MAMP/htdocs/slidust/src/components/layout/Header.jsx)
  Header kontekstual, notification center, profile menu, dan akses ke settings.

## Modul dan Fitur

### 1. Login dan Organisasi

File utama:
- [src/pages/Login.jsx](/Applications/MAMP/htdocs/slidust/src/pages/Login.jsx)

Fitur:
- Login dengan username dan password.
- Simpan token auth ke `localStorage`.
- Jika user tergabung ke lebih dari satu organisasi, login dilanjutkan ke langkah pemilihan organisasi.
- Organisasi aktif disimpan di `currentUser.active_organization_id` dan mempengaruhi visibilitas project setelah login.

Nilai praktis:
- User yang punya multi-organization tidak langsung dilempar ke semua data sekaligus.
- Scope kerja langsung dibatasi sejak awal sesi.

### 2. Sidebar dan Navigasi

File utama:
- [src/components/layout/Sidebar.jsx](/Applications/MAMP/htdocs/slidust/src/components/layout/Sidebar.jsx)
- [src/App.jsx](/Applications/MAMP/htdocs/slidust/src/App.jsx)

Fitur:
- Sidebar bisa collapse dan responsif untuk mobile.
- Daftar project muncul sesuai hak akses dan organisasi aktif user.
- Navigasi utama: `My Board`, `Dashboard`, `Dust Flow`, serta project list.
- Deep-link berbasis query string:
  - `?myboard`
  - `?home`
  - `?project=<id>`
  - `?task=<id>`
  - `?dustflow`
  - `?dustflow=<id>`
  - `?tab=<mode>`
  - `?note=<id>`

Nilai praktis:
- Halaman, task, flow, dan note bisa dibuka langsung lewat URL.
- Browser back/forward tetap sinkron dengan state aplikasi.

### 3. Header, Profil, dan Notifikasi

File utama:
- [src/components/layout/Header.jsx](/Applications/MAMP/htdocs/slidust/src/components/layout/Header.jsx)

Fitur:
- Header berubah sesuai konteks halaman aktif.
- Notification center dengan unread badge.
- Aksi notifikasi:
  - mark as read
  - mark all as read
  - clear all
- Klik notifikasi bisa membuka task terkait.
- Dropdown profil menyediakan akses ke:
  - profile
  - members
  - organizations
  - logout

Jenis notifikasi yang terdeteksi di UI:
- Task assignment
- Mention di komentar

### 4. My Board

File utama:
- [src/components/myboard/MyBoard.jsx](/Applications/MAMP/htdocs/slidust/src/components/myboard/MyBoard.jsx)

Fitur:
- Menampilkan task lintas project yang assigned ke user.
- Subtask yang assigned ke user juga ikut dihitung sebagai tugas user.
- Filter status:
  - On Progress
  - Backlog
  - Done
  - All
- Sort:
  - Priority
  - Created
- Admin/manager bisa memfilter board berdasarkan user lain.
- Card task memuat konteks project, due date, status, subtask progress, komentar, dan attachment.

Nilai praktis:
- User tidak perlu membuka banyak project untuk tahu semua pekerjaan yang jadi tanggung jawabnya.

### 5. Dashboard

File utama:
- [src/components/dashboard/Dashboard.jsx](/Applications/MAMP/htdocs/slidust/src/components/dashboard/Dashboard.jsx)

Fitur:
- Scope data hanya dari project yang terlihat oleh user.
- Filter kombinasi:
  - assignee
  - position
  - project
  - workflow/status
- Ringkasan total task, open, in progress, dan done.
- Tabel task terbaru berdasarkan `latestCommentAt` atau `created_at`.
- Team performance chart menggunakan `recharts`.
- Avatar dipakai langsung di sumbu chart untuk identifikasi visual user.

Nilai praktis:
- Dashboard bukan hanya angka global, tetapi benar-benar mengikuti scope akses user dan filter operasional.

### 6. Project Board

File utama:
- [src/components/board/Board.jsx](/Applications/MAMP/htdocs/slidust/src/components/board/Board.jsx)
- [src/components/board/Column.jsx](/Applications/MAMP/htdocs/slidust/src/components/board/Column.jsx)

Fitur inti:
- Board per project berbasis workflow stage.
- Pencarian task.
- Filter assignee via avatar chips.
- Drag-and-drop antar kolom dan reordering di kolom yang sama.
- Highlight singkat saat task pindah stage.
- Tombol `Create Task`.
- Empty state jika project belum punya workflow.

Mode tampilan di project:
- `Roadmap`
- `Board`
- `List`
- `Calendar`
- `Reporting`
- `Notes`

Nilai praktis:
- Satu project bisa diakses dalam beberapa sudut pandang tanpa pindah aplikasi.

### 7. Activity Ticker

File terkait:
- [src/components/board/Board.jsx](/Applications/MAMP/htdocs/slidust/src/components/board/Board.jsx)
- [src/components/board/ActivityTicker.jsx](/Applications/MAMP/htdocs/slidust/src/components/board/ActivityTicker.jsx)

Fitur:
- Menghitung task stale di workflow `PROGRESS`.
- Task dianggap stale jika tidak ada aktivitas komentar dalam 5 hari.
- Menampilkan assignee, waktu idle, dan komentar terakhir.
- Klik item ticker bisa membuka task terkait.

Nilai praktis:
- Board tidak hanya menunjukkan status, tapi juga mendeteksi pekerjaan yang macet.

### 8. Task Modal

File utama:
- [src/components/modals/TaskModal.jsx](/Applications/MAMP/htdocs/slidust/src/components/modals/TaskModal.jsx)

Fitur task:
- Buat task baru atau edit task yang ada.
- Field utama:
  - title
  - description
  - status
  - priority
  - assignee
  - start date
  - due date
  - subtasks
- Rich text description dengan React Quill.
- Auto-save ter-debounce saat user mengubah data.
- Dirty state saat perubahan belum tersimpan.
- Read-only mode saat task dibuka dari konteks tertentu.

Fitur subtask:
- Tambah, edit, hapus subtask.
- Assign subtask ke user project.
- Status subtask:
  - Backlog
  - On Progress
  - Done

Fitur komentar:
- Thread komentar per task.
- Polling komentar tiap 15 detik saat modal terbuka.
- Mention user dengan `@handle`.
- Mention diubah menjadi notifikasi.
- Highlight chip mention saat dirender.

Fitur attachment:
- Upload banyak file.
- Limit ukuran file 20 MB per file.
- Delete attachment.
- Preview attachment.
- Jumlah attachment task disinkronkan ke state task.

Fitur akses:
- `Open in Project` jika task dibuka dari luar konteks project.
- Delete task dibatasi oleh role/creator tertentu.

Nilai praktis:
- Task modal berfungsi sebagai pusat kolaborasi lengkap, bukan sekadar form CRUD.

### 9. Project Notes

File utama:
- [src/components/board/BoardNotes.jsx](/Applications/MAMP/htdocs/slidust/src/components/board/BoardNotes.jsx)

Fitur:
- Notes khusus per project.
- Grid card note dengan author avatar dan tanggal update.
- Modal note dengan auto-save.
- Deep-link note menggunakan query string `?note=<id>`.
- Delete note dengan confirm dialog.

Nilai praktis:
- Catatan project hidup berdampingan dengan board, bukan tercecer di tool lain.

### 10. Workflow Management

Sumber data:
- [src/context/DataContext.jsx](/Applications/MAMP/htdocs/slidust/src/context/DataContext.jsx)

Fitur:
- Tambah stage workflow.
- Update nama, warna, dan tipe stage.
- Hapus stage.
- Reorder stage.
- Tipe workflow yang dipakai di UI:
  - `BACKLOG`
  - `PROGRESS`
  - `DONE`

Nilai praktis:
- Banyak tampilan lain di app membaca tipe workflow ini, jadi workflow bukan hanya dekorasi kolom.

### 11. Project Management

Sumber data:
- [src/context/DataContext.jsx](/Applications/MAMP/htdocs/slidust/src/context/DataContext.jsx)
- modal terkait di folder [src/components/modals](/Applications/MAMP/htdocs/slidust/src/components/modals)

Fitur:
- Buat, edit, dan hapus project.
- Project baru otomatis di-assign ke organisasi pertama user saat ini.
- Backend mengembalikan workflow default untuk project baru.
- Project membership dapat ditambah/hapus.
- Ikon project bisa ditampilkan di sidebar dan header.

### 12. User, Position, dan Department Management

Sumber data:
- [src/context/DataContext.jsx](/Applications/MAMP/htdocs/slidust/src/context/DataContext.jsx)

Fitur:
- Tambah user.
- Edit profil user.
- Update avatar user.
- Reset password user.
- CRUD position.
- CRUD department.

Nilai praktis:
- Struktur organisasi tidak hanya atribut kosmetik, tetapi dipakai untuk filter, scope, dan personal board.

### 13. Organization Management

Sumber data:
- [src/context/DataContext.jsx](/Applications/MAMP/htdocs/slidust/src/context/DataContext.jsx)

Fitur:
- CRUD organization.
- Assign/remove member ke organization.
- Assign/remove project ke organization.
- Filter otomatis project berdasarkan organisasi aktif user.

Nilai praktis:
- Slidust mendukung lingkungan multi-organization tanpa harus membuat instance aplikasi terpisah.

### 14. Dust Flow

File utama:
- [src/components/drawflow/FlowList.jsx](/Applications/MAMP/htdocs/slidust/src/components/drawflow/FlowList.jsx)
- [src/components/drawflow/FlowEditor.jsx](/Applications/MAMP/htdocs/slidust/src/components/drawflow/FlowEditor.jsx)

Fitur list:
- Create new flow.
- Preview thumbnail flow dari node dan edge aktual.
- Delete flow.
- Card menampilkan nama flow, tanggal update, dan owner avatar.

Fitur editor:
- Canvas visual berbasis `@xyflow/react`.
- Bottom floating toolbar untuk shape.
- Shape/node yang tersedia mencakup:
  - text
  - sticky note
  - rectangle
  - rounded
  - diamond
  - circle
  - step
  - input/output
  - database
  - person
- Drag node, connect edge, delete, dan edit property.
- Property panel untuk style node/edge.
- Property panel otomatis disembunyikan saat drag node.
- Copy link flow.
- Rename flow inline.
- Avatar owner dan editor access tampil di area nama flow.
- Modal `Flow Access` untuk memilih user editor.
- State view-only dengan ikon gembok menggantikan tombol save.
- Unsaved changes prompt sebelum keluar.

Visibility dan permission:
- Default flow baru: `Public`.
- `Public`: semua user bisa melihat flow.
- `Private`: hanya owner dan user yang diberi editor access bisa melihat flow.
- Edit flow:
  - owner bisa edit penuh
  - user di `editor_ids` bisa edit isi flow dan nama
  - hanya owner yang bisa mengubah visibility dan daftar editor
  - user lain view-only

Nilai praktis:
- Dust Flow bukan sekadar whiteboard, tapi flow tool internal yang sudah punya governance dasar.

## Model Permission

### Role aplikasi

Role yang muncul di codebase:
- `admin`
- `manager`
- `member`

Pola umum:
- `admin` dan `manager` punya akses lebih luas untuk project/workflow management.
- `member` biasanya dibatasi ke project yang memang diikutinya.
- Visibilitas data juga dipengaruhi organisasi aktif.

### Scope project

Aturan project di `DataContext`:
- Admin/manager bisa melihat semua project di organisasi aktif.
- Member hanya melihat project yang memiliki relasi `project_members` dengan dirinya.
- Task dan workflow otomatis ikut tersaring berdasarkan project yang terlihat.

### Scope Dust Flow

Aturan flow di `DataContext` dan backend:
- Flow public terlihat oleh semua user.
- Flow private hanya terlihat oleh owner dan editor yang ditambahkan.
- Edit flow diizinkan untuk owner dan editor access.
- Pengaturan access dan visibility hanya owner.

## Sinkronisasi Data dan Perilaku UX

Hal-hal penting di state layer:
- Initial data load dilakukan paralel lewat `Promise.all`.
- Tasks dan notifications dipolling tiap 30 detik saat tab aktif.
- Comments di task dipolling tiap 15 detik saat modal task terbuka.
- Beberapa area memakai optimistic update:
  - add/update/delete task
  - project
  - note
  - flow
- Saat token auth expired dan API mengembalikan `401`, user dipaksa logout dan kembali ke halaman awal.

## Apa yang Unik dari Slidust

Berikut hal-hal yang paling menonjol dibanding app task management biasa:

1. Satu produk, empat cara kerja utama
   Slidust tidak berhenti di kanban board. Ada personal workboard, dashboard analytics, project notes, dan flow editor dalam satu pengalaman yang saling terhubung.

2. My Board berbasis tanggung jawab nyata
   Task utama dan subtask sama-sama dihitung sebagai beban kerja user. Ini membuat personal board lebih representatif dibanding sekadar daftar assignee task utama.

3. Board yang peka terhadap “task macet”
   Adanya `ActivityTicker` untuk task stale di stage progress membuat app berfungsi sebagai alat monitoring, bukan hanya papan status.

4. Multi-view project tanpa pindah tool
   Satu project bisa dibaca sebagai board, list, calendar, roadmap, reporting, dan notes. Ini mengurangi fragmentasi kerja tim.

5. Multi-organization login flow
   User yang tergabung di banyak organisasi memilih scope kerja sejak login, bukan sesudah data terlanjur dimuat.

6. Dust Flow dengan permission yang lebih matang
   Flow diagram sudah mendukung public/private visibility, owner-only governance, editor access, share link, preview card, dan mode view-only.

7. Deep-link yang konsisten
   Task, note, tab, dan flow bisa dibuka lewat URL. Ini penting untuk share context cepat antar user atau saat notifikasi diklik.

8. Mention ke notifikasi tanpa sistem chat terpisah
   Comment mention langsung memicu notification flow di dalam task collaboration layer.

9. State layer yang cukup terpusat
   Banyak kemampuan lintas modul bergantung pada satu `DataContext`, sehingga fitur-fitur terasa menyatu dan data access lebih konsisten.

## Alur Penggunaan Singkat

### Untuk member

1. Login dan pilih organization jika diminta.
2. Buka `My Board` untuk melihat semua task/subtask yang menjadi tanggung jawab.
3. Buka task, update status, komentar, subtasks, dan attachment.
4. Masuk ke project untuk melihat board, calendar, roadmap, atau notes.
5. Buka `Dust Flow` untuk melihat flow yang public atau yang dibagikan kepadanya.

### Untuk manager/admin

1. Kelola project, workflow, dan members.
2. Pantau dashboard dan reporting lintas project yang bisa diakses.
3. Gunakan `ActivityTicker` untuk melihat task stagnan.
4. Kelola organizations, positions, departments, dan visibility data.
5. Gunakan Dust Flow sebagai area visual planning atau dokumentasi proses.

## File Penting untuk Developer

- [src/App.jsx](/Applications/MAMP/htdocs/slidust/src/App.jsx)
  Entry point UI shell dan route berbasis query string.
- [src/context/DataContext.jsx](/Applications/MAMP/htdocs/slidust/src/context/DataContext.jsx)
  Sumber utama logic data, auth, filtering, dan CRUD.
- [src/components/modals/TaskModal.jsx](/Applications/MAMP/htdocs/slidust/src/components/modals/TaskModal.jsx)
  Fitur task paling kompleks: autosave, comments, mention, attachment, subtasks.
- [src/components/board/Board.jsx](/Applications/MAMP/htdocs/slidust/src/components/board/Board.jsx)
  Orkestrasi mode tampilan project.
- [src/components/drawflow/FlowEditor.jsx](/Applications/MAMP/htdocs/slidust/src/components/drawflow/FlowEditor.jsx)
  Inti pengalaman Dust Flow.
- [src/pages/Login.jsx](/Applications/MAMP/htdocs/slidust/src/pages/Login.jsx)
  Login dan organization selection flow.

## Catatan Pengembangan

- `README.md` sebelumnya masih template Vite dan sekarang sudah diganti menjadi dokumentasi produk.
- Dokumentasi ini disusun berdasarkan implementasi yang ada di frontend codebase saat ini.
- Jika dibutuhkan, tahap berikutnya yang paling berguna biasanya:
  - menambahkan dokumentasi API endpoint backend
  - menambahkan diagram role/permission
  - menambahkan user journey per role
  - menambahkan screenshot per modul
