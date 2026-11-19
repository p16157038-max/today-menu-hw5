# 課程方法與本次改版的對應

本次為第十一週1117重新繳交原第五週1006的Vibe Coding互動選餐作品。原稿已有40道起始資料、品牌與高價餐、搜尋、收藏、歷史及菜單管理；本輪新增無候選恢復、符合理由與三餐比較，再整合視覺、條件摘要及手機操作。

| 課程 | 實際採用的層次與方法 | 功能或紀錄 |
| --- | --- | --- |
| HW5 Vibe Coding | 需求討論形成SPEC，再實作網頁並公開GitHub Pages。 | SPEC.md、index.html、editorial.css、公開網站 |
| HW8 Reflection觀念 | 開發過程參考產出、檢查、修正與重驗。 | 320px初輪操作字8–10px、高25–37px；修正後抽查操作達至少12px與44px。evidence/mobile-first-pass.json及ux-public.json |
| HW9 AGENTS.md | 將功能、資料、儲存與完成條件寫成AI可讀規則。 | 恢復只改一項、提高預算須明示、不自行取消素食、比較上限三餐、保留舊資料。AGENTS.md與recoveryOptions()、applyRecovery()、renderComparison() |
| HW10 loop與graph觀念 | 檢查前移、錯誤回到負責步驟局部調整，再驗公開版本。 | tests/hw11-regression.cjs、21組及240狀態、瀏覽器功能30項與介面13項；evidence紀錄日期與雜湊 |

上述近期課程的應用在開發與維護層。網站執行時以JavaScript及目前可編輯菜單計算預算、篩選與比較；Reflection為修訂方法參考，loop為品質檢查流程。新增自訂資料後仍依目前菜單運作。

課程參照：HW8《教AI做事的方法》第19至21頁；HW9《換你當老闆》第18、22、24頁；HW10《把你的工作拆成AI能做的流程》第14、21至26、45至47頁。完整中越文報告、動機分析與原新版畫面見submission/。
