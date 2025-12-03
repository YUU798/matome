class CharacterDialogueManager {
    constructor() {
        this.currentTable = null;
        this.tables = this.loadTables();
        this.isDeleteMode = false;
        this.selectedRows = new Set();
        this.isFavoriteFilterActive = false;
        this.initializeEventListeners();
        this.checkForSavedTable();
        this.syncWithServer(); // バックグラウンドでサーバーと同期
    }

    // ローカルストレージからテーブルデータを読み込む
    loadTables() {
        const saved = localStorage.getItem('characterDialogueTables');
        const tables = saved ? JSON.parse(saved) : {};
        
        // 古いデータ形式を新しい形式に変換
        Object.keys(tables).forEach(tableName => {
            if (Array.isArray(tables[tableName])) {
                // 古い形式（配列）を新しい形式（オブジェクト）に変換
                tables[tableName] = {
                    data: tables[tableName],
                    tags: []
                };
            }
        });
        
        return tables;
    }

    // テーブルデータをローカルストレージに保存し、サーバーにも送信
    async saveTables() {
        const data = JSON.stringify(this.tables);
        localStorage.setItem('characterDialogueTables', data);
        try {
            const response = await fetch('/api/tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: data
            });
            if (!response.ok) {
                throw new Error(`サーバー保存失敗: ${response.status}`);
            }
        } catch (error) {
            console.warn('サーバーへの保存に失敗しました:', error);
            alert('サーバーへの保存に失敗しました。ローカルには保存されていますが、他のデバイスには反映されない可能性があります。');
        }
    }

    // イベントリスナーの初期化
    initializeEventListeners() {
        // 初期選択画面のボタン
        document.getElementById('load-existing').addEventListener('click', () => this.showTableSelection());
        document.getElementById('create-new').addEventListener('click', () => this.createNewTable());
        document.getElementById('delete-table').addEventListener('click', () => this.showTableDeleteSelection());

        // 表選択モーダル
        document.getElementById('close-selection').addEventListener('click', () => this.hideTableSelection());

        // 表削除モーダル
        document.getElementById('close-delete-selection').addEventListener('click', () => this.hideTableDeleteSelection());
        document.getElementById('confirm-table-delete').addEventListener('click', () => this.deleteSelectedTables());

        // メイン作業画面のボタン
        document.getElementById('back-to-home').addEventListener('click', () => this.backToHome());
        document.getElementById('add-row').addEventListener('click', () => this.addRow());
        document.getElementById('delete-row').addEventListener('click', () => this.toggleDeleteMode());
        document.getElementById('save-table').addEventListener('click', () => this.saveCurrentTable());

        // 検索機能
        document.getElementById('search-input').addEventListener('input', () => this.filterTable());
        document.getElementById('toggle-favorite-filter').addEventListener('click', () => this.toggleFavoriteFilter());
        document.getElementById('clear-search').addEventListener('click', () => this.clearSearch());

        // 削除モードのボタン
        document.getElementById('confirm-delete').addEventListener('click', () => this.deleteSelectedRows());
        document.getElementById('cancel-delete').addEventListener('click', () => this.cancelDeleteMode());

        // タグ編集機能
        document.getElementById('edit-tags').addEventListener('click', () => this.showTagEditModal());
        document.getElementById('save-tags').addEventListener('click', () => this.saveTags());
        document.getElementById('close-tag-edit').addEventListener('click', () => this.hideTagEditModal());

        // テーマ設定機能
        document.getElementById('theme-settings').addEventListener('click', () => this.showThemeSettings());
        document.getElementById('close-theme-settings').addEventListener('click', () => this.hideThemeSettings());
        
        // テーマ選択のイベントリスナー
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', () => this.selectTheme(option.dataset.theme));
        });

        // 保存されたテーマを適用
        this.applySavedTheme();
    }

    // 保存されたテーブルがあるかチェック
    checkForSavedTable() {
        // ローカルストレージから最後に開いたテーブルを取得
        const savedTable = localStorage.getItem('currentCharacterTable');
        if (savedTable && this.tables[savedTable]) {
            this.currentTable = savedTable;
            this.showMainScreen();
            this.loadTable(savedTable);
        }
    }

    // 表選択モーダルを表示
    showTableSelection() {
        const modal = document.getElementById('table-selection-modal');
        const tableList = document.getElementById('table-list');
        const tagFilterList = document.getElementById('table-selection-tag-filter');
        
        tableList.innerHTML = '';
        tagFilterList.innerHTML = '';
        
        const tableNames = Object.keys(this.tables);
        
        // すべてのタグを収集
        const allTags = new Set();
        tableNames.forEach(tableName => {
            const tableInfo = this.tables[tableName];
            const tags = tableInfo.tags || [];
            tags.forEach(tag => allTags.add(tag));
        });
        
        // タグフィルターを表示
        if (allTags.size === 0) {
            tagFilterList.innerHTML = '<span style="color: #666; font-style: italic;">タグが設定されていません</span>';
        } else {
            Array.from(allTags).forEach(tag => {
                const tagElement = document.createElement('div');
                tagElement.className = 'tag-filter';
                tagElement.textContent = tag;
                tagElement.dataset.tag = tag;
                
                tagElement.addEventListener('click', () => {
                    this.toggleTableSelectionTagFilter(tagElement);
                });
                
                tagFilterList.appendChild(tagElement);
            });
        }
        
        if (tableNames.length === 0) {
            tableList.innerHTML = '<p style="text-align: center; color: #666;">保存された表がありません</p>';
        } else {
            this.renderTableSelectionList(tableNames);
        }
        
        modal.style.display = 'flex';
    }

    // 表選択のタグフィルターを切り替え
    toggleTableSelectionTagFilter(tagElement) {
        if (tagElement.classList.contains('selected')) {
            tagElement.classList.remove('selected');
        } else {
            tagElement.classList.add('selected');
        }
        this.filterTableSelection();
    }

    // 表選択リストをフィルタリング
    filterTableSelection() {
        const selectedTags = Array.from(document.querySelectorAll('#table-selection-tag-filter .tag-filter.selected'))
            .map(tag => tag.dataset.tag);
        
        const tableNames = Object.keys(this.tables);
        this.renderTableSelectionList(tableNames, selectedTags);
    }

    // 表選択リストをレンダリング
    renderTableSelectionList(tableNames, selectedTags = []) {
        const tableList = document.getElementById('table-list');
        tableList.innerHTML = '';
        
        tableNames.forEach(tableName => {
            const tableInfo = this.tables[tableName];
            const tags = tableInfo.tags || [];
            
            // タグフィルターが適用されている場合、マッチする表のみ表示
            if (selectedTags.length > 0) {
                const hasMatchingTag = selectedTags.some(selectedTag =>
                    tags.includes(selectedTag)
                );
                if (!hasMatchingTag) return;
            }
            
            const tableItem = document.createElement('div');
            tableItem.className = 'table-item';
            
            // 表名とタグを表示
            const nameElement = document.createElement('div');
            nameElement.textContent = tableName;
            nameElement.style.fontWeight = 'bold';
            nameElement.style.marginBottom = '5px';
            
            tableItem.appendChild(nameElement);
            
            // タグ表示
            if (tags.length > 0) {
                const tagsContainer = document.createElement('div');
                tagsContainer.className = 'tags-display';
                
                tags.forEach(tag => {
                    const tagElement = document.createElement('span');
                    tagElement.className = 'tag';
                    tagElement.textContent = tag;
                    tagsContainer.appendChild(tagElement);
                });
                
                tableItem.appendChild(tagsContainer);
            }
            
            tableItem.addEventListener('click', () => {
                this.loadTable(tableName);
                this.hideTableSelection();
            });
            tableList.appendChild(tableItem);
        });
        
        if (tableList.children.length === 0) {
            tableList.innerHTML = '<p style="text-align: center; color: #666;">該当する表がありません</p>';
        }
    }

    // 表選択モーダルを非表示
    hideTableSelection() {
        document.getElementById('table-selection-modal').style.display = 'none';
    }

    // 表削除選択モーダルを表示
    showTableDeleteSelection() {
        const modal = document.getElementById('table-delete-modal');
        const tableList = document.getElementById('table-delete-list');
        
        tableList.innerHTML = '';
        
        const tableNames = Object.keys(this.tables);
        
        if (tableNames.length === 0) {
            tableList.innerHTML = '<p style="text-align: center; color: #666;">削除できる表がありません</p>';
        } else {
            tableNames.forEach(tableName => {
                const tableItem = document.createElement('div');
                tableItem.className = 'table-item';
                
                // 表名とタグを表示
                const tableInfo = this.tables[tableName];
                const tags = tableInfo.tags || [];
                
                const nameElement = document.createElement('div');
                nameElement.textContent = tableName;
                nameElement.style.fontWeight = 'bold';
                nameElement.style.marginBottom = '5px';
                
                tableItem.appendChild(nameElement);
                
                // タグ表示
                if (tags.length > 0) {
                    const tagsContainer = document.createElement('div');
                    tagsContainer.className = 'tags-display';
                    
                    tags.forEach(tag => {
                        const tagElement = document.createElement('span');
                        tagElement.className = 'tag';
                        tagElement.textContent = tag;
                        tagsContainer.appendChild(tagElement);
                    });
                    
                    tableItem.appendChild(tagsContainer);
                }
                
                tableItem.dataset.tableName = tableName;
                tableItem.addEventListener('click', () => {
                    this.toggleTableSelection(tableItem);
                });
                tableList.appendChild(tableItem);
            });
        }
        
        modal.style.display = 'flex';
    }

    // 表削除選択モーダルを非表示
    hideTableDeleteSelection() {
        document.getElementById('table-delete-modal').style.display = 'none';
        // 選択状態をリセット
        document.querySelectorAll('#table-delete-list .table-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
    }

    // 表の選択状態を切り替え
    toggleTableSelection(tableItem) {
        if (tableItem.classList.contains('selected')) {
            tableItem.classList.remove('selected');
        } else {
            tableItem.classList.add('selected');
        }
    }

    // 表選択UIを更新（開いているモーダルがあれば再描画）
    updateTableSelectionUI() {
        const selectionModal = document.getElementById('table-selection-modal');
        if (selectionModal.style.display === 'flex') {
            this.showTableSelection();
        }
        const deleteModal = document.getElementById('table-delete-modal');
        if (deleteModal.style.display === 'flex') {
            this.showTableDeleteSelection();
        }
    }

    // 選択した表を削除
    async deleteSelectedTables() {
        const selectedTables = document.querySelectorAll('#table-delete-list .table-item.selected');
        
        if (selectedTables.length === 0) {
            alert('削除する表を選択してください。');
            return;
        }
        
        const tableNames = Array.from(selectedTables).map(item => item.dataset.tableName);
        const confirmMessage = `${tableNames.length}個の表を削除しますか？\n\n${tableNames.join('\n')}`;
        
        if (confirm(confirmMessage)) {
            tableNames.forEach(tableName => {
                delete this.tables[tableName];
            });
            
            await this.saveTables();
            this.hideTableDeleteSelection();
            this.updateTableSelectionUI();
            alert('表を削除しました。');
            
            // 現在開いている表が削除された場合はホームに戻る
            if (this.currentTable && !this.tables[this.currentTable]) {
                this.backToHome();
            }
        }
    }

    // 新しい表を作成
    createNewTable() {
        const tableName = prompt('キャラクター名を入力してください:\n\n（タグを設定する場合は、名前の後にカンマで区切って入力してください）\n例: 〜〜(名称),主人公,ヒロイン');
        if (tableName && tableName.trim()) {
            const inputParts = tableName.split(',').map(part => part.trim());
            const cleanName = inputParts[0];
            const tags = inputParts.slice(1).filter(tag => tag);
            
            if (!this.tables[cleanName]) {
                this.tables[cleanName] = {
                    data: [],
                    tags: tags
                };
                this.saveTables();
                this.currentTable = cleanName;
                this.showMainScreen();
                this.loadTable(cleanName);
            } else {
                alert('同じ名前の表が既に存在します。別の名前を入力してください。');
            }
        }
    }

    // 表を読み込む
    loadTable(tableName) {
        this.currentTable = tableName;
        const tableInfo = this.tables[tableName];
        const tableData = tableInfo ? tableInfo.data : [];
        
        document.getElementById('current-table-name').textContent = tableName;
        this.renderTable(tableData);
        this.showMainScreen();
        this.renderTableTags(tableInfo ? tableInfo.tags : []);
        
        // 現在のテーブルを記憶
        localStorage.setItem('currentCharacterTable', tableName);
    }

    // 表のタグを表示
    renderTableTags(tags) {
        const tableTagsContainer = document.getElementById('table-tags');
        tableTagsContainer.innerHTML = '';
        
        if (tags.length === 0) {
            return;
        }
        
        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'table-tag';
            tagElement.textContent = tag;
            tableTagsContainer.appendChild(tagElement);
        });
    }

    // メイン作業画面を表示
    showMainScreen() {
        document.getElementById('initial-screen').style.display = 'none';
        document.getElementById('main-screen').style.display = 'block';
    }

    // ホーム画面に戻る
    backToHome() {
        document.getElementById('main-screen').style.display = 'none';
        document.getElementById('initial-screen').style.display = 'flex';
        this.currentTable = null;
        localStorage.removeItem('currentCharacterTable');
        this.cancelDeleteMode();
        this.resetFavoriteFilter();
    }

    // お気に入りフィルターをリセット
    resetFavoriteFilter() {
        this.isFavoriteFilterActive = false;
        const filterButton = document.getElementById('toggle-favorite-filter');
        filterButton.textContent = 'お気に入りのみ表示';
        filterButton.classList.remove('active');
    }

    // テーブルをレンダリング
    renderTable(data) {
        const tableBody = document.getElementById('table-body');
        tableBody.innerHTML = '';
        
        data.forEach((row, index) => {
            const tr = this.createTableRow(row.dialogue, row.story, index, row.isFavorite || false);
            tableBody.appendChild(tr);
        });
        
        // データがない場合は空の行を追加
        if (data.length === 0) {
            this.addRow();
        }
    }

    // テーブル行を作成
    createTableRow(dialogue = '', story = '', index = null, isFavorite = false) {
        const tr = document.createElement('tr');
        if (index !== null) {
            tr.dataset.index = index;
        }
        
        // セリフ列（ハートマークを内包）
        const dialogueTd = document.createElement('td');
        dialogueTd.className = 'tooltip';
        
        // お気に入りハートマーク
        const favoriteHeart = document.createElement('span');
        favoriteHeart.className = 'favorite-heart';
        favoriteHeart.innerHTML = '♥';
        favoriteHeart.dataset.isFavorite = isFavorite;
        
        if (isFavorite) {
            favoriteHeart.classList.add('favorited');
        }
        
        favoriteHeart.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFavorite(tr, favoriteHeart);
        });
        
        dialogueTd.appendChild(favoriteHeart);
        
        const dialogueInput = document.createElement('input');
        dialogueInput.type = 'text';
        dialogueInput.placeholder = 'セリフを入力...';
        dialogueInput.value = dialogue;
        dialogueInput.addEventListener('input', () => {
            this.autoSave();
            // ツールチップの内容を更新
            dialogueTd.dataset.tooltip = dialogueInput.value || 'セリフが入力されていません';
        });
        dialogueTd.appendChild(dialogueInput);
        
        // 初期ツールチップ設定
        dialogueTd.dataset.tooltip = dialogue || 'セリフが入力されていません';
        
        // ストーリー名列
        const storyTd = document.createElement('td');
        storyTd.className = 'tooltip';
        
        const storyInput = document.createElement('input');
        storyInput.type = 'text';
        storyInput.placeholder = 'ストーリー名を入力...';
        storyInput.value = story;
        storyInput.addEventListener('input', () => {
            this.autoSave();
            // ツールチップの内容を更新
            storyTd.dataset.tooltip = storyInput.value || 'ストーリー名が入力されていません';
        });
        storyTd.appendChild(storyInput);
        
        // 初期ツールチップ設定
        storyTd.dataset.tooltip = story || 'ストーリー名が入力されていません';
        
        tr.appendChild(dialogueTd);
        tr.appendChild(storyTd);
        
        // 行クリックイベント（削除モード時のみ）
        tr.addEventListener('click', (e) => {
            if (this.isDeleteMode && e.target.tagName !== 'INPUT' && !e.target.classList.contains('favorite-heart')) {
                this.toggleRowSelection(tr);
            }
        });
        
        return tr;
    }

    // 行を追加
    addRow() {
        const tableBody = document.getElementById('table-body');
        const newRow = this.createTableRow();
        tableBody.appendChild(newRow);
        this.autoSave();
    }

    // 削除モードの切り替え
    toggleDeleteMode() {
        this.isDeleteMode = !this.isDeleteMode;
        const deleteModeIndicator = document.getElementById('delete-mode-indicator');
        const deleteButton = document.getElementById('delete-row');
        
        if (this.isDeleteMode) {
            deleteModeIndicator.style.display = 'flex';
            deleteButton.textContent = '削除モード終了';
            deleteButton.classList.add('btn-warning');
        } else {
            this.cancelDeleteMode();
        }
    }

    // 削除モードをキャンセル
    cancelDeleteMode() {
        this.isDeleteMode = false;
        this.selectedRows.clear();
        
        document.getElementById('delete-mode-indicator').style.display = 'none';
        document.getElementById('delete-row').textContent = '行を削除';
        document.getElementById('delete-row').classList.remove('btn-warning');
        
        // 選択状態を解除
        document.querySelectorAll('#table-body tr.selected').forEach(tr => {
            tr.classList.remove('selected');
        });
    }

    // 行の選択状態を切り替え
    toggleRowSelection(tr) {
        if (tr.classList.contains('selected')) {
            tr.classList.remove('selected');
            this.selectedRows.delete(tr);
        } else {
            tr.classList.add('selected');
            this.selectedRows.add(tr);
        }
    }

    // 選択した行を削除
    async deleteSelectedRows() {
        if (this.selectedRows.size === 0) {
            alert('削除する行を選択してください。');
            return;
        }
        
        if (confirm(`${this.selectedRows.size}行を削除しますか？`)) {
            const tableBody = document.getElementById('table-body');
            
            this.selectedRows.forEach(tr => {
                tableBody.removeChild(tr);
            });
            
            this.selectedRows.clear();
            this.cancelDeleteMode();
            await this.autoSave();
            this.filterTable();
        }
    }

    // 現在のテーブルデータを取得
    getCurrentTableData() {
        const tableBody = document.getElementById('table-body');
        const rows = tableBody.querySelectorAll('tr');
        const data = [];
        
        rows.forEach(tr => {
            const inputs = tr.querySelectorAll('input');
            const dialogue = inputs[0].value.trim();
            const story = inputs[1].value.trim();
            const favoriteHeart = tr.querySelector('.favorite-heart');
            const isFavorite = favoriteHeart ? favoriteHeart.dataset.isFavorite === 'true' : false;
            
            // 両方空の行は保存しない
            if (dialogue || story) {
                data.push({
                    dialogue: dialogue,
                    story: story,
                    isFavorite: isFavorite
                });
            }
        });
        
        return data;
    }

    // 自動保存
    async autoSave() {
        if (this.currentTable) {
            const data = this.getCurrentTableData();
            // 既存のタグ情報を保持
            const existingTags = this.tables[this.currentTable] ? this.tables[this.currentTable].tags : [];
            this.tables[this.currentTable] = {
                data: data,
                tags: existingTags
            };
            await this.saveTables();
        }
    }

    // 現在のテーブルを保存
    saveCurrentTable() {
        if (this.currentTable) {
            this.autoSave();
            alert('保存しました！');
        } else {
            alert('保存する表が選択されていません。');
        }
    }

    // 検索をクリア
    clearSearch() {
        document.getElementById('search-input').value = '';
        this.filterTable();
    }

    // お気に入りの切り替え
    toggleFavorite(tr, heartElement) {
        const isCurrentlyFavorite = heartElement.dataset.isFavorite === 'true';
        const newFavoriteState = !isCurrentlyFavorite;
        
        heartElement.dataset.isFavorite = newFavoriteState;
        
        if (newFavoriteState) {
            heartElement.classList.add('favorited');
        } else {
            heartElement.classList.remove('favorited');
        }
        
        this.autoSave();
    }

    // お気に入りフィルターの切り替え
    toggleFavoriteFilter() {
        this.isFavoriteFilterActive = !this.isFavoriteFilterActive;
        const filterButton = document.getElementById('toggle-favorite-filter');
        
        if (this.isFavoriteFilterActive) {
            filterButton.textContent = 'すべて表示';
            filterButton.classList.add('active');
        } else {
            filterButton.textContent = 'お気に入りのみ表示';
            filterButton.classList.remove('active');
        }
        
        this.filterTable();
    }

    // テーブルをフィルタリング（検索とお気に入り）
    filterTable() {
        const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
        const tableBody = document.getElementById('table-body');
        const rows = tableBody.querySelectorAll('tr');
        
        rows.forEach(tr => {
            const inputs = tr.querySelectorAll('input');
            const dialogue = inputs[0].value.toLowerCase();
            const story = inputs[1].value.toLowerCase();
            const favoriteHeart = tr.querySelector('.favorite-heart');
            const isFavorite = favoriteHeart ? favoriteHeart.dataset.isFavorite === 'true' : false;
            
            // 検索条件のチェック
            const searchMatch = searchTerm === '' ||
                               dialogue.includes(searchTerm) ||
                               story.includes(searchTerm);
            
            // お気に入りフィルター条件のチェック
            const favoriteMatch = !this.isFavoriteFilterActive || isFavorite;
            
            // 両方の条件を満たす場合のみ表示
            if (searchMatch && favoriteMatch) {
                tr.style.display = '';
            } else {
                tr.style.display = 'none';
            }
        });
    }

    // タグ編集モーダルを表示
    showTagEditModal() {
        if (!this.currentTable) {
            alert('表が選択されていません。');
            return;
        }

        const modal = document.getElementById('tag-edit-modal');
        const tagInput = document.getElementById('tag-edit-input');
        
        // 現在のタグを入力フィールドに設定
        const currentTags = this.tables[this.currentTable] ? this.tables[this.currentTable].tags : [];
        tagInput.value = currentTags.join(', ');
        
        modal.style.display = 'flex';
    }

    // タグ編集モーダルを非表示
    hideTagEditModal() {
        document.getElementById('tag-edit-modal').style.display = 'none';
    }

    // タグを保存
    saveTags() {
        if (!this.currentTable) {
            alert('表が選択されていません。');
            return;
        }

        const tagInput = document.getElementById('tag-edit-input');
        const tagString = tagInput.value.trim();
        
        // タグを解析（カンマ区切り、空白除去）
        const newTags = tagString.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag !== '');
        
        // タグを保存
        if (this.tables[this.currentTable]) {
            this.tables[this.currentTable].tags = newTags;
            this.saveTables();
            
            // 表示を更新
            this.renderTableTags(newTags);
            this.hideTagEditModal();
            
            alert('タグを保存しました。');
        }
    }

    // テーマ設定モーダルを表示
    showThemeSettings() {
        document.getElementById('theme-settings-modal').style.display = 'flex';
    }

    // テーマ設定モーダルを非表示
    hideThemeSettings() {
        document.getElementById('theme-settings-modal').style.display = 'none';
    }

    // テーマを選択
    selectTheme(themeName) {
        this.applyTheme(themeName);
        this.saveTheme(themeName);
        this.hideThemeSettings();
        alert(`テーマを「${this.getThemeDisplayName(themeName)}」に変更しました。`);
    }

    // テーマを適用
    applyTheme(themeName) {
        // 現在のテーマクラスを削除
        document.body.classList.remove('strawberry-milk-theme', 'cotton-theme', 'pudding-a-la-mode-theme');
        
        // 新しいテーマクラスを追加
        document.body.classList.add(`${themeName}-theme`);
    }

    // テーマの表示名を取得
    getThemeDisplayName(themeName) {
        const themeNames = {
            'strawberry-milk': 'いちごみるく',
            'cotton': 'コットン',
            'pudding-a-la-mode': 'プリンアラモード'
        };
        return themeNames[themeName] || themeName;
    }

    // テーマを保存
    saveTheme(themeName) {
        localStorage.setItem('selectedTheme', themeName);
    }

    // 保存されたテーマを適用
    applySavedTheme() {
        const savedTheme = localStorage.getItem('selectedTheme');
        if (savedTheme) {
            this.applyTheme(savedTheme);
        }
    }

    // サーバーとデータを同期
    async syncWithServer() {
        try {
            const response = await fetch('/api/tables');
            if (response.ok) {
                const serverTables = await response.json();
                // サーバーのデータでローカルを上書き（マージ）
                let updated = false;
                Object.keys(serverTables).forEach(tableName => {
                    // ローカルに存在するテーブルのみ更新（新規テーブルは追加しない）
                    if (this.tables[tableName] && JSON.stringify(this.tables[tableName]) !== JSON.stringify(serverTables[tableName])) {
                        this.tables[tableName] = serverTables[tableName];
                        updated = true;
                    }
                });
                if (updated) {
                    // ローカルストレージに保存
                    localStorage.setItem('characterDialogueTables', JSON.stringify(this.tables));
                    // UIを更新（現在開いているテーブルがあれば再読み込み）
                    if (this.currentTable && this.tables[this.currentTable]) {
                        this.loadTable(this.currentTable);
                    }
                }
            }
        } catch (error) {
            console.warn('サーバーとの同期に失敗しました:', error);
        }
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    new CharacterDialogueManager();
});