const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// データファイルのパス
const DATA_FILE = path.join(__dirname, 'data', 'characterDialogueTables.json');

// データディレクトリの存在確認と作成
async function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// データファイルの読み込み
async function loadData() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // ファイルが存在しない場合は空のオブジェクトを返す
    return {};
  }
}

// データファイルの保存
async function saveData(data) {
  try {
    await ensureDataDir();
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('データの保存に失敗しました:', error);
    throw error;
  }
}

// API: テーブルデータの取得
app.get('/api/tables', async (req, res) => {
  try {
    const tables = await loadData();
    res.json(tables);
  } catch (error) {
    console.error('テーブルデータの取得に失敗しました:', error);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// API: テーブルデータの保存
app.post('/api/tables', async (req, res) => {
  try {
    const tables = req.body;
    if (typeof tables !== 'object' || tables === null) {
      return res.status(400).json({ error: '無効なデータ形式' });
    }
    await saveData(tables);
    res.json({ success: true });
  } catch (error) {
    console.error('テーブルデータの保存に失敗しました:', error);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// メインページのルート
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
  console.log('ブラウザで上記のURLを開いてアプリケーションを確認してください');
});