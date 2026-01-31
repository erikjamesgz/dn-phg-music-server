#!/bin/bash

echo "========================================="
echo "获取搜索结果"
echo "========================================="

# 获取搜索结果
SEARCH_RESULT=$(curl -s "http://localhost:8080/api/search?keyword=%E5%8D%81%E5%B9%B4&page=1&limit=10")

echo "$SEARCH_RESULT" > /tmp/search_result_raw.json

echo ""
echo "搜索结果已保存到 /tmp/search_result_raw.json"
echo ""

# 提取不同平台的歌曲数据
echo "========================================="
echo "提取各平台歌曲数据"
echo "========================================="

# 提取咪咕音乐歌曲
MG_SONG=$(echo "$SEARCH_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data['data']['results']
mg_songs = [r for r in results if r.get('source') == 'mg']
if mg_songs:
    song = mg_songs[0]
    print(json.dumps({
        'source': 'mg',
        'copyrightId': song['musicInfo']['copyrightId'],
        'lrcUrl': song['musicInfo'].get('lrcUrl', ''),
        'mrcUrl': song['musicInfo'].get('mrcUrl', ''),
        'trcUrl': song['musicInfo'].get('trcUrl', ''),
        'name': song['name']
    }))
")
echo "咪咕音乐歌曲: $MG_SONG"
echo "$MG_SONG" > /tmp/mg_song.json

# 提取酷我音乐歌曲
KW_SONG=$(echo "$SEARCH_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data['data']['results']
kw_songs = [r for r in results if r.get('source') == 'kw']
if kw_songs:
    song = kw_songs[0]
    print(json.dumps({
        'source': 'kw',
        'songId': song['musicInfo']['songmid'],
        'name': song['name']
    }))
")
echo "酷我音乐歌曲: $KW_SONG"
echo "$KW_SONG" > /tmp/kw_song.json

# 提取酷狗音乐歌曲
KG_SONG=$(echo "$SEARCH_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data['data']['results']
kg_songs = [r for r in results if r.get('source') == 'kg']
if kg_songs:
    song = kg_songs[0]
    print(json.dumps({
        'source': 'kg',
        'hash': song['musicInfo']['hash'],
        'name': song['name']
    }))
")
echo "酷狗音乐歌曲: $KG_SONG"
echo "$KG_SONG" > /tmp/kg_song.json

# 提取腾讯音乐歌曲
TX_SONG=$(echo "$SEARCH_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data['data']['results']
tx_songs = [r for r in results if r.get('source') == 'tx']
if tx_songs:
    song = tx_songs[0]
    print(json.dumps({
        'source': 'tx',
        'songId': song['musicInfo']['songmid'],
        'name': song['name']
    }))
")
echo "腾讯音乐歌曲: $TX_SONG"
echo "$TX_SONG" > /tmp/tx_song.json

# 提取网易云音乐歌曲
WY_SONG=$(echo "$SEARCH_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data['data']['results']
wy_songs = [r for r in results if r.get('source') == 'wy']
if wy_songs:
    song = wy_songs[0]
    print(json.dumps({
        'source': 'wy',
        'songId': song['musicInfo']['songmid'],
        'name': song['name']
    }))
")
echo "网易云音乐歌曲: $WY_SONG"
echo "$WY_SONG" > /tmp/wy_song.json

echo ""
echo "========================================="
echo "歌曲数据提取完成"
echo "========================================="
