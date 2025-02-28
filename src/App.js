import React, { useState, useEffect } from 'react'; // 导入React及其钩子函数
import _ from 'lodash'; // 导入Lodash工具库
import Papa from 'papaparse'; // 导入Papa Parse用于解析CSV文件

const App = () => {
  // 基本状态定义
  const [originalText, setOriginalText] = useState(''); // 原始文本状态
  const [annotator1Data, setAnnotator1Data] = useState([]); // 标注者1的数据状态
  const [annotator2Data, setAnnotator2Data] = useState([]); // 标注者2的数据状态
  const [combinedData, setCombinedData] = useState([]); // 合并后的标注数据状态
  const [selectedSegment, setSelectedSegment] = useState(''); // 当前选中的文本段状态
  const [reviewerOpinions, setReviewerOpinions] = useState({}); // 审稿人的意见状态
  const [sourceInfo, setSourceInfo] = useState({}); // 来源信息状态
  const [error, setError] = useState(''); // 错误信息状态
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false); // 是否仅显示书签状态
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false); // 是否仅显示差异状态
  const [showTypicalExamplesView, setShowTypicalExamplesView] = useState(false); // 是否显示典型示例视图状态
  const [isLoading, setIsLoading] = useState(false); // 加载状态
  const [filesReady, setFilesReady] = useState({ // 文件就绪状态
    original: false, // 原始文本文件是否就绪
    annotator1: false, // 标注者1文件是否就绪
    annotator2: false // 标注者2文件是否就绪
  });

  // 文件读取工具函数
  const readTextFile = (file) => { // 读取文本文件的函数
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); // 创建文件读取器
      reader.onload = (e) => resolve(e.target.result); // 读取成功时返回文件内容
      reader.onerror = () => reject('Error reading file'); // 读取失败时返回错误
      reader.readAsText(file); // 以文本形式读取文件
    });
  };

  const parseCSV = (file) => { // 解析CSV文件的函数
    return new Promise((resolve, reject) => {
      Papa.parse(file, { // 使用Papa Parse解析CSV
        header: true, // 第一行作为表头
        skipEmptyLines: true, // 跳过空行
        complete: (results) => { // 解析完成回调
          if (results.errors.length) reject('CSV parsing error'); // 如果有错误则拒绝
          resolve(results.data); // 成功则返回解析数据
        },
        error: () => reject('File reading failed') // 文件读取失败时拒绝
      });
    });
  };

  // 处理标注数据
  const processAnnotationData = (data) => { // 处理标注数据的函数
    return data.map(row => { // 遍历每一行数据
      const keys = Object.keys(row); // 获取所有列名
      const textKey = keys.find(k => k.toLowerCase().includes('text')) || keys[0]; // 查找包含'text'的列名
      const roleKey = keys.find(k => k.toLowerCase().includes('role')) || keys[1]; // 查找包含'role'的列名
      const mainCatKey = keys.find(k => k.toLowerCase().includes('main')) || keys[2]; // 查找包含'main'的列名
      const subCatKey = keys.find(k => k.toLowerCase().includes('sub')) || keys[3]; // 查找包含'sub'的列名
      const polarityKey = keys.find(k => k.toLowerCase().includes('polarity')) || keys[4]; // 查找包含'polarity'的列名
      return { // 返回标准化后的数据对象
        text: row[textKey], // 文本内容
        role: row[roleKey], // 评价角色
        mainCategory: row[mainCatKey], // 主类别
        subCategory: row[subCatKey], // 子类别
        polarity: row[polarityKey] // 极性
      };
    });
  };

  // 处理文件上传
  const handleFileUpload = (e, fileType) => { // 文件上传处理函数
    const file = e.target.files[0]; // 获取上传的文件
    if (!file) return; // 如果没有文件则返回

    setIsLoading(true); // 设置加载状态为true
    if (fileType === 'original') { // 如果是原始文本文件
      readTextFile(file) // 读取文本文件
          .then(content => { // 成功后
            setOriginalText(content); // 设置原始文本
            setFilesReady(prev => ({ ...prev, original: true })); // 更新文件就绪状态
          })
          .catch(error => setError(error)) // 捕获错误
          .finally(() => setIsLoading(false)); // 结束加载状态
    } else if (fileType === 'annotator1') { // 如果是标注者1的文件
      parseCSV(file) // 解析CSV文件
          .then(data => { // 成功后
            setAnnotator1Data(processAnnotationData(data)); // 设置标注者1数据
            setFilesReady(prev => ({ ...prev, annotator1: true })); // 更新文件就绪状态
          })
          .catch(error => setError(error)) // 捕获错误
          .finally(() => setIsLoading(false)); // 结束加载状态
    } else if (fileType === 'annotator2') { // 如果是标注者2的文件
      parseCSV(file) // 解析CSV文件
          .then(data => { // 成功后
            setAnnotator2Data(processAnnotationData(data)); // 设置标注者2数据
            setFilesReady(prev => ({ ...prev, annotator2: true })); // 更新文件就绪状态
          })
          .catch(error => setError(error)) // 捕获错误
          .finally(() => setIsLoading(false)); // 结束加载状态
    }
  };

  // 分析标注数据
  const analyzeAnnotations = () => { // 分析标注的函数
    const allSegments = _.uniq([...annotator1Data.map(a => a.text), ...annotator2Data.map(a => a.text)]); // 获取所有唯一文本段
    const combined = allSegments.map(segment => { // 遍历所有文本段
      const anno1 = annotator1Data.find(a => a.text === segment); // 查找标注者1的标注
      const anno2 = annotator2Data.find(a => a.text === segment); // 查找标注者2的标注
      let status; // 定义状态变量
      if (anno1 && anno2) { // 如果两者都有标注
        if (
            anno1.role === anno2.role && // 角色相同
            anno1.mainCategory === anno2.mainCategory && // 主类别相同
            anno1.subCategory === anno2.subCategory && // 子类别相同
            anno1.polarity === anno2.polarity // 极性相同
        ) {
          status = 'match'; // 完全匹配
        } else {
          status = 'overlap'; // 有重叠但不完全匹配
        }
      } else if (anno1 && !anno2) { // 仅标注者1有标注
        status = 'missing'; // 标注者2缺失
      } else { // 仅标注者2有标注
        status = 'spurious'; // 标注者1多余
      }
      return { // 返回合并后的数据对象
        text: segment, // 文本段
        annotator1: anno1, // 标注者1数据
        annotator2: anno2, // 标注者2数据
        status // 状态
      };
    });
    setCombinedData(combined); // 设置合并数据状态
  };

  // 使用localStorage加载和保存数据
  useEffect(() => { // 文件就绪时触发分析
    const allFilesReady = filesReady.original && filesReady.annotator1 && filesReady.annotator2; // 检查所有文件是否就绪
    if (allFilesReady) analyzeAnnotations(); // 如果就绪则分析标注
  }, [filesReady, annotator1Data, annotator2Data]); // 依赖文件就绪状态和标注数据

  useEffect(() => { // 加载保存的数据
    try {
      const savedData = localStorage.getItem('appraisalData'); // 从localStorage获取数据
      if (savedData) { // 如果有数据
        const data = JSON.parse(savedData); // 解析JSON
        if (data.reviewerOpinions) setReviewerOpinions(data.reviewerOpinions); // 设置审稿人意见
        if (data.sourceInfo) setSourceInfo(data.sourceInfo); // 设置来源信息
      }
    } catch (error) {
      console.error("Error loading saved data:", error); // 捕获加载错误
    }
  }, []); // 仅在组件挂载时运行

  useEffect(() => { // 保存数据到localStorage
    const allFilesReady = filesReady.original && filesReady.annotator1 && filesReady.annotator2; // 检查所有文件是否就绪
    if (allFilesReady && combinedData.length > 0) { // 如果文件就绪且有合并数据
      try {
        const dataToSave = { // 要保存的数据对象
          reviewerOpinions, // 审稿人意见
          sourceInfo, // 来源信息
          lastUpdated: new Date().toISOString() // 最后更新时间
        };
        localStorage.setItem('appraisalData', JSON.stringify(dataToSave)); // 保存到localStorage
      } catch (error) {
        console.error("Error saving data:", error); // 捕获保存错误
      }
    }
  }, [reviewerOpinions, sourceInfo, combinedData, filesReady]); // 依赖相关状态

  // 切换书签状态
  const toggleBookmark = (text) => { // 切换书签的函数
    setReviewerOpinions(prev => { // 更新审稿人意见
      const current = prev[text] || {}; // 获取当前文本的意见
      return {
        ...prev, // 保留其他意见
        [text]: { // 更新当前文本的意见
          ...current, // 保留其他字段
          bookmarked: !current.bookmarked // 切换书签状态
        }
      };
    });
  };

  // 更新来源信息
  const updateSource = (text, source) => { // 更新来源信息的函数
    setSourceInfo(prev => ({ // 更新来源信息状态
      ...prev, // 保留其他来源
      [text]: source // 更新当前文本的来源
    }));
  };

  // 更新审稿人意见
  const updateOpinion = (text, field, value) => { // 更新审稿人意见的函数
    setReviewerOpinions(prev => { // 更新审稿人意见状态
      const current = prev[text] || {}; // 获取当前文本的意见
      return {
        ...prev, // 保留其他意见
        [text]: { // 更新当前文本的意见
          ...current, // 保留其他字段
          [field]: value // 更新指定字段
        }
      };
    });
  };

  // 导出HTML报告
  const exportHTMLReport = () => { // 导出HTML报告的函数
    const opinions = Object.entries(reviewerOpinions); // 获取所有审稿人意见
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Appraisal Theory Annotation Report</title> 
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; } /* 页面样式 */
          h1, h2, h3 { color: #333; } /* 标题颜色 */
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; } /* 表格样式 */
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } /* 表格单元格样式 */
          th { background-color: #f2f2f2; } /* 表头背景色 */
          tr:nth-child(even) { background-color: #f9f9f9; } /* 偶数行背景色 */
          .bookmarked { background-color: #fff2cc; } /* 书签样式 */
          .match { background-color: #d9ead3; } /* 匹配样式 */
          .overlap { background-color: #fff2cc; } /* 重叠样式 */
          .missing { background-color: #f4cccc; } /* 缺失样式 */
          .spurious { background-color: #d0e0e3; } /* 多余样式 */
          .summary { background-color: #eee; padding: 15px; border-radius: 5px; margin-bottom: 20px; } /* 摘要样式 */
        </style>
      </head>
      <body>
        <h1>Appraisal Theory Annotation Report</h1> 
        <div class="summary">
          <h2>Summary</h2> 
          <p>Total annotations: ${combinedData.length}</p> 
          <p>Perfect matches: ${combinedData.filter(i => i.status === 'match').length}</p> 
          <p>Overlaps: ${combinedData.filter(i => i.status === 'overlap').length}</p> 
          <p>Missing: ${combinedData.filter(i => i.status === 'missing').length}</p> 
          <p>Spurious: ${combinedData.filter(i => i.status === 'spurious').length}</p> 
          <p>Agreement rate: ${((combinedData.filter(i => i.status === 'match').length / combinedData.length) * 100).toFixed(2)}%</p> 
          <p>Report generated: ${new Date().toLocaleString()}</p> 
        </div>
        <h2>Typical Examples (Bookmarked)</h2> 
    `;

    const bookmarkedOpinions = opinions.filter(([_, opinion]) => opinion.bookmarked); // 筛选书签意见
    if (bookmarkedOpinions.length > 0) { // 如果有书签意见
      html += `
        <table>
          <tr>
            <th>Text</th> 
            <th>Status</th> 
            <th>Annotator 1</th> 
            <th>Annotator 2</th> 
            <th>Reviewer Opinion</th> 
            <th>Notes</th> 
            <th>Source</th> 
          </tr>
      `;
      bookmarkedOpinions.forEach(([text, opinion]) => { // 遍历书签意见
        const item = combinedData.find(i => i.text === text); // 查找对应合并数据
        const source = sourceInfo[text] || ''; // 获取来源信息
        html += `
          <tr class="bookmarked ${item?.status || ''}">
            <td>${text}</td> 
            <td>${item?.status || 'Unknown'}</td> 
            <td>${item?.annotator1 ? // 标注者1数据
            `Role: ${item.annotator1.role || ''}<br>
               Main: ${item.annotator1.mainCategory || ''}<br>
               Sub: ${item.annotator1.subCategory || ''}<br>
               Polarity: ${item.annotator1.polarity || ''}`
            : 'Not annotated'} 
            </td>
            <td>${item?.annotator2 ? // 标注者2数据
            `Role: ${item.annotator2.role || ''}<br>
               Main: ${item.annotator2.mainCategory || ''}<br>
               Sub: ${item.annotator2.subCategory || ''}<br>
               Polarity: ${item.annotator2.polarity || ''}`
            : 'Not annotated'} 
            </td>
            <td>
              Role: ${opinion.role || ''}<br> 
              Main: ${opinion.mainCategory || ''}<br> 
              Sub: ${opinion.subCategory || ''}<br> 
              Polarity: ${opinion.polarity || ''} 
            </td>
            <td>${opinion.notes || ''}</td> 
            <td>${source}</td> 
          </tr>
        `;
      });
      html += `</table>`;
    } else {
      html += `<p>No bookmarked examples found.</p>`; // 无书签示例
    }

    html += `
      <h2>All Annotations with Reviewer Opinions</h2> 
      <table>
        <tr>
          <th>Text</th> 
          <th>Status</th> 
          <th>Annotator 1</th> 
          <th>Annotator 2</th> 
          <th>Reviewer Opinion</th> 
          <th>Notes</th> 
          <th>Source</th> 
        </tr>
    `;
    opinions.forEach(([text, opinion]) => { // 遍历所有意见
      const item = combinedData.find(i => i.text === text); // 查找对应合并数据
      const source = sourceInfo[text] || ''; // 获取来源信息
      html += `
        <tr class="${opinion.bookmarked ? 'bookmarked' : ''} ${item?.status || ''}">
          <td>${text}</td> 
          <td>${item?.status || 'Unknown'}</td> 
          <td>${item?.annotator1 ? // 标注者1数据
          `Role: ${item.annotator1.role || ''}<br>
             Main: ${item.annotator1.mainCategory || ''}<br>
             Sub: ${item.annotator1.subCategory || ''}<br>
             Polarity: ${item.annotator1.polarity || ''}`
          : 'Not annotated'} 
          </td>
          <td>${item?.annotator2 ? // 标注者2数据
          `Role: ${item.annotator2.role || ''}<br>
             Main: ${item.annotator2.mainCategory || ''}<br>
             Sub: ${item.annotator2.subCategory || ''}<br>
             Polarity: ${item.annotator2.polarity || ''}`
          : 'Not annotated'} 
          </td>
          <td>
            Role: ${opinion.role || ''}<br> 
            Main: ${opinion.mainCategory || ''}<br> 
            Sub: ${opinion.subCategory || ''}<br> 
            Polarity: ${opinion.polarity || ''} 
          </td>
          <td>${opinion.notes || ''}</td> 
          <td>${source}</td> 
        </tr>
      `;
    });

    html += `
        </table>
        <h2>All Annotations</h2> 
        <table>
          <tr>
            <th>Text</th> 
            <th>Status</th> 
            <th>Annotator 1</th> 
            <th>Annotator 2</th> 
          </tr>
    `;
    combinedData.forEach(item => { // 遍历所有合并数据
      html += `
        <tr class="${item.status}">
          <td>${item.text}</td> 
          <td>${item.status}</td> 
          <td>${item.annotator1 ? // 标注者1数据
          `Role: ${item.annotator1.role || ''}<br>
             Main: ${item.annotator1.mainCategory || ''}<br>
             Sub: ${item.annotator1.subCategory || ''}<br>
             Polarity: ${item.annotator1.polarity || ''}`
          : 'Not annotated'} 
          </td>
          <td>${item.annotator2 ? // 标注者2数据
          `Role: ${item.annotator2.role || ''}<br>
             Main: ${item.annotator2.mainCategory || ''}<br>
             Sub: ${item.annotator2.subCategory || ''}<br>
             Polarity: ${item.annotator2.polarity || ''}`
          : 'Not annotated'} 
          </td>
        </tr>
      `;
    });

    html += `
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html' }); // 创建HTML Blob对象
    const url = URL.createObjectURL(blob); // 生成URL
    const a = document.createElement('a'); // 创建下载链接
    a.href = url; // 设置链接地址
    a.download = 'appraisal_report.html'; // 设置文件名
    document.body.appendChild(a); // 添加到DOM
    a.click(); // 触发下载
    document.body.removeChild(a); // 移除链接
    URL.revokeObjectURL(url); // 释放URL
  };

  // 导出CSV文件
  const exportCSV = () => { // 导出CSV文件的函数
    const opinions = Object.entries(reviewerOpinions); // 获取所有审稿人意见
    let csv = "Text,Status,Annotator1_Role,Annotator1_MainCategory,Annotator1_SubCategory,Annotator1_Polarity,"; // CSV表头
    csv += "Annotator2_Role,Annotator2_MainCategory,Annotator2_SubCategory,Annotator2_Polarity,";
    csv += "Reviewer_Role,Reviewer_MainCategory,Reviewer_SubCategory,Reviewer_Polarity,Notes,Source,Bookmarked\n";

    opinions.forEach(([text, opinion]) => { // 遍历所有意见
      const item = combinedData.find(i => i.text === text); // 查找对应合并数据
      const source = sourceInfo[text] || ''; // 获取来源信息
      const safeText = `"${text.replace(/"/g, '""')}"`; // 处理文本中的引号
      csv += `${safeText},${item?.status || 'Unknown'},`; // 添加文本和状态
      csv += `${item?.annotator1?.role || ''},${item?.annotator1?.mainCategory || ''},`; // 标注者1数据
      csv += `${item?.annotator1?.subCategory || ''},${item?.annotator1?.polarity || ''},`;
      csv += `${item?.annotator2?.role || ''},${item?.annotator2?.mainCategory || ''},`; // 标注者2数据
      csv += `${item?.annotator2?.subCategory || ''},${item?.annotator2?.polarity || ''},`;
      csv += `${opinion.role || ''},${opinion.mainCategory || ''},`; // 审稿人意见
      csv += `${opinion.subCategory || ''},${opinion.polarity || ''},`;
      const safeNotes = opinion.notes ? `"${opinion.notes.replace(/"/g, '""')}"` : ''; // 处理笔记中的引号
      const safeSource = source ? `"${source.replace(/"/g, '""')}"` : ''; // 处理来源中的引号
      csv += `${safeNotes},${safeSource},${opinion.bookmarked ? 'Yes' : 'No'}\n`; // 添加笔记、来源和书签状态
    });

    const blob = new Blob([csv], { type: 'text/csv' }); // 创建CSV Blob对象
    const url = URL.createObjectURL(blob); // 生成URL
    const a = document.createElement('a'); // 创建下载链接
    a.href = url; // 设置链接地址
    a.download = 'appraisal_data.csv'; // 设置文件名
    document.body.appendChild(a); // 添加到DOM
    a.click(); // 触发下载
    document.body.removeChild(a); // 移除链接
    URL.revokeObjectURL(url); // 释放URL
  };

  // 渲染带标注的文本
  const renderAnnotatedText = () => { // 渲染带标注文本的函数
    if (!originalText || combinedData.length === 0) return <p>No content to display yet</p>; // 如果没有文本或数据则返回提示
    let lastIndex = 0; // 上一个标注的结束位置
    const segments = []; // 文本段数组
    const sortedAnnotations = _.sortBy(combinedData, item => originalText.indexOf(item.text)); // 按文本出现顺序排序
    for (const item of sortedAnnotations) { // 遍历排序后的标注
      const index = originalText.indexOf(item.text, lastIndex); // 查找文本段位置
      if (index === -1) continue; // 如果找不到则跳过
      if (index > lastIndex) segments.push(<span key={`plain-${lastIndex}`}>{originalText.substring(lastIndex, index)}</span>); // 添加普通文本
      let bgColor; // 背景颜色变量
      switch (item.status) { // 根据状态设置背景颜色
        case 'match': bgColor = 'bg-green-200'; break; // 匹配
        case 'overlap': bgColor = 'bg-yellow-200'; break; // 重叠
        case 'missing': bgColor = 'bg-red-200'; break; // 缺失
        case 'spurious': bgColor = 'bg-blue-200'; break; // 多余
        default: bgColor = 'bg-gray-200'; // 默认
      }
      const isBookmarked = reviewerOpinions[item.text]?.bookmarked; // 检查是否为书签
      segments.push( // 添加标注文本段
          <span
              key={`anno-${index}`}
              className={`${bgColor} px-1 py-0.5 rounded cursor-pointer ${selectedSegment === item.text ? 'font-bold' : ''} ${isBookmarked ? 'border-2 border-yellow-500' : ''}`}
              onClick={() => setSelectedSegment(item.text)} // 点击时选中该段
          >
          {item.text}
        </span>
      );
      lastIndex = index + item.text.length; // 更新最后位置
    }
    if (lastIndex < originalText.length) segments.push(<span key="plain-end">{originalText.substring(lastIndex)}</span>); // 添加剩余文本
    return <div>{segments}</div>; // 返回文本段集合
  };

  // 渲染标注详情
  const renderAnnotationDetails = () => { // 渲染标注详情的函数
    if (!selectedSegment) return <p>Click on a highlighted text to view details</p>; // 如果未选中则返回提示
    const item = combinedData.find(i => i.text === selectedSegment); // 查找选中段的合并数据
    if (!item) return <p>Item not found</p>; // 如果未找到则返回提示
    const opinion = reviewerOpinions[selectedSegment] || {}; // 获取审稿人意见
    const source = sourceInfo[selectedSegment] || ''; // 获取来源信息
    let statusLabel; // 状态标签
    switch (item.status) { // 根据状态设置标签
      case 'match': statusLabel = <span className="text-green-600">Match</span>; break; // 匹配
      case 'overlap': statusLabel = <span className="text-yellow-600">Overlap</span>; break; // 重叠
      case 'missing': statusLabel = <span className="text-red-600">Missing (Annotator 2)</span>; break; // 缺失
      case 'spurious': statusLabel = <span className="text-blue-600">Spurious (Annotator 1)</span>; break; // 多余
      default: statusLabel = <span>Unknown</span>; // 未知
    }

    return (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">"{selectedSegment}"</h3>
            <button
                onClick={() => toggleBookmark(selectedSegment)} // 切换书签
                className="text-xl text-yellow-500 focus:outline-none"
                title={opinion.bookmarked ? "Remove bookmark" : "Add bookmark (mark as typical example)"} // 书签提示
            >
              {opinion.bookmarked ? "★" : "☆"}
            </button>
          </div>
          <p className="mb-2">Status: {statusLabel}</p>
          <div className="mb-3">
            <label className="block mb-1">Source/Reference:</label>
            <input
                type="text"
                className="w-full p-2 border rounded"
                placeholder="Enter source (e.g., page number, document)" // 来源占位符
                value={source}
                onChange={(e) => updateSource(selectedSegment, e.target.value)} // 更新来源
            />
          </div>
          <div className="mb-3">
            <label className="block mb-1">Notes:</label>
            <textarea
                className="w-full p-2 border rounded"
                placeholder="Add your notes here..." // 笔记占位符
                value={opinion.notes || ''}
                onChange={(e) => updateOpinion(selectedSegment, 'notes', e.target.value)} // 更新笔记
                rows="2"
            />
          </div>
          <table className="w-full border-collapse">
            <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Attribute</th>
              <th className="border p-2">Annotator 1</th>
              <th className="border p-2">Annotator 2</th>
              <th className="border p-2">Reviewer Opinion</th>
            </tr>
            </thead>
            <tbody>
            <tr>
              <td className="border p-2 font-medium">Appraisal Role</td>
              <td className="border p-2">{item.annotator1?.role || 'Not annotated'}</td>
              <td className="border p-2">{item.annotator2?.role || 'Not annotated'}</td>
              <td className="border p-2">
                <select
                    className="w-full p-1 border rounded"
                    value={opinion.role || ''}
                    onChange={(e) => updateOpinion(selectedSegment, 'role', e.target.value)} // 更新角色意见
                >
                  <option value="">Select opinion...</option>
                  {item.annotator1 && (
                      <option value={` Agree with A1: ${item.annotator1.role}`}>
                        Agree with A1: {item.annotator1.role}
                      </option>
                  )}
                  {item.annotator2 && (
                      <option value={` Agree with A2: ${item.annotator2.role}`}>
                        Agree with A2: {item.annotator2.role} 
                      </option>
                  )}
                  <option value="Do not annotate">Do not annotate</option> 
                  <option value="Other">Other</option> 
                </select>
                {opinion.role === 'Other' && ( // 如果选择其他
                    <input
                        type="text"
                        className="w-full p-1 mt-1 border rounded"
                        placeholder="Custom opinion" // 自定义意见占位符
                        value={opinion.roleCustom || ''}
                        onChange={(e) => updateOpinion(selectedSegment, 'roleCustom', e.target.value)} // 更新自定义角色
                    />
                )}
              </td>
            </tr>
            <tr>
              <td className="border p-2 font-medium">Main Category</td> 
              <td className="border p-2">{item.annotator1?.mainCategory || 'Not annotated'}</td> 
              <td className="border p-2">{item.annotator2?.mainCategory || 'Not annotated'}</td> 
              <td className="border p-2">
                <select
                    className="w-full p-1 border rounded"
                    value={opinion.mainCategory || ''}
                    onChange={(e) => updateOpinion(selectedSegment, 'mainCategory', e.target.value)} // 更新主类别意见
                >
                  <option value="">Select opinion...</option> 
                  {item.annotator1 && (
                      <option value={` Agree with A1: ${item.annotator1.mainCategory}`}>
                        Agree with A1: {item.annotator1.mainCategory} 
                      </option>
                  )}
                  {item.annotator2 && (
                      <option value={` Agree with A2: ${item.annotator2.mainCategory}`}>
                        Agree with A2: {item.annotator2.mainCategory} 
                      </option>
                  )}
                  <option value="affect">affect</option> 
                  <option value="judgement">judgement</option> 
                  <option value="appreciation">appreciation</option> 
                  <option value="Do not annotate">Do not annotate</option> 
                  <option value="Other">Other</option> 
                </select>
                {opinion.mainCategory === 'Other' && ( // 如果选择其他
                    <input
                        type="text"
                        className="w-full p-1 mt-1 border rounded"
                        placeholder="Custom opinion" // 自定义意见占位符
                        value={opinion.mainCategoryCustom || ''}
                        onChange={(e) => updateOpinion(selectedSegment, 'mainCategoryCustom', e.target.value)} // 更新自定义主类别
                    />
                )}
              </td>
            </tr>
            <tr>
              <td className="border p-2 font-medium">Sub Category</td> 
              <td className="border p-2">{item.annotator1?.subCategory || 'Not annotated'}</td> 
              <td className="border p-2">{item.annotator2?.subCategory || 'Not annotated'}</td> 
              <td className="border p-2">
                <select
                    className="w-full p-1 border rounded"
                    value={opinion.subCategory || ''}
                    onChange={(e) => updateOpinion(selectedSegment, 'subCategory', e.target.value)} // 更新子类别意见
                >
                  <option value="">Select opinion...</option> 
                  {item.annotator1 && (
                      <option value={` Agree with A1: ${item.annotator1.subCategory}`}>
                        Agree with A1: {item.annotator1.subCategory} 
                      </option>
                  )}
                  {item.annotator2 && (
                      <option value={` Agree with A2: ${item.annotator2.subCategory}`}>
                        Agree with A2: {item.annotator2.subCategory} 
                      </option>
                  )}
                  <option value="Do not annotate">Do not annotate</option> 
                  <option value="Other">Other</option> 
                </select>
                {opinion.subCategory === 'Other' && ( // 如果选择其他
                    <input
                        type="text"
                        className="w-full p-1 mt-1 border rounded"
                        placeholder="Custom opinion" // 自定义意见占位符
                        value={opinion.subCategoryCustom || ''}
                        onChange={(e) => updateOpinion(selectedSegment, 'subCategoryCustom', e.target.value)} // 更新自定义子类别
                    />
                )}
              </td>
            </tr>
            <tr>
              <td className="border p-2 font-medium">Polarity</td> 
              <td className="border p-2">{item.annotator1?.polarity || 'Not annotated'}</td> 
              <td className="border p-2">{item.annotator2?.polarity || 'Not annotated'}</td> 
              <td className="border p-2">
                <select
                    className="w-full p-1 border rounded"
                    value={opinion.polarity || ''}
                    onChange={(e) => updateOpinion(selectedSegment, 'polarity', e.target.value)} // 更新极性意见
                >
                  <option value="">Select opinion...</option> 
                  {item.annotator1 && (
                      <option value={` Agree with A1: ${item.annotator1.polarity}`}>
                        Agree with A1: {item.annotator1.polarity} 
                      </option>
                  )}
                  {item.annotator2 && (
                      <option value={` Agree with A2: ${item.annotator2.polarity}`}>
                        Agree with A2: {item.annotator2.polarity} 
                      </option>
                  )}
                  <option value="positive">positive</option> 
                  <option value="negative">negative</option> 
                  <option value="Do not annotate">Do not annotate</option> 
                  <option value="Other">Other</option> 
                </select>
                {opinion.polarity === 'Other' && ( // 如果选择其他
                    <input
                        type="text"
                        className="w-full p-1 mt-1 border rounded"
                        placeholder="Custom opinion" // 自定义意见占位符
                        value={opinion.polarityCustom || ''}
                        onChange={(e) => updateOpinion(selectedSegment, 'polarityCustom', e.target.value)} // 更新自定义极性
                    />
                )}
              </td>
            </tr>
            </tbody>
          </table>
        </div>
    );
  };

  // 渲染统计数据
  const renderStatistics = () => { // 渲染统计数据的函数
    if (combinedData.length === 0) return <p>No data available yet</p>; // 如果没有数据则返回提示
    const matches = combinedData.filter(i => i.status === 'match').length; // 计算匹配数
    const overlaps = combinedData.filter(i => i.status === 'overlap').length; // 计算重叠数
    const missing = combinedData.filter(i => i.status === 'missing').length; // 计算缺失数
    const spurious = combinedData.filter(i => i.status === 'spurious').length; // 计算多余数
    const total = combinedData.length; // 总标注数
    const agreementPct = ((matches / total) * 100).toFixed(2); // 计算一致率

    return (
        <div>
          <h3 className="font-semibold mb-2">Overall Statistics</h3> 
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <p>Total annotations: {total}</p> 
              <p>Perfect matches: {matches}</p> 
              <p>Overlaps (different values): {overlaps}</p> 
              <p>Missing (annotator 2): {missing}</p> 
              <p>Spurious (annotator 1): {spurious}</p> 
              <p>Agreement percentage: {agreementPct}%</p> 
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p>Bookmarked examples: {Object.values(reviewerOpinions).filter(o => o.bookmarked).length}</p> 
              <p>Reviewer opinions: {Object.keys(reviewerOpinions).length}</p> 
              <div className="mt-3">
                <button
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded mr-2"
                    onClick={exportHTMLReport} // 导出HTML报告
                >
                  Export HTML Report 
                </button>
                <button
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                    onClick={exportCSV} // 导出CSV
                >
                  Export CSV 
                </button>
              </div>
            </div>
          </div>
        </div>
    );
  };

  // 渲染典型示例
  const renderTypicalExamples = () => { // 渲染典型示例的函数
    const bookmarkedItems = Object.entries(reviewerOpinions) // 获取书签项
        .filter(([_, opinion]) => opinion.bookmarked) // 筛选书签意见
        .map(([text]) => combinedData.find(item => item.text === text)) // 查找对应合并数据
        .filter(item => item); // 过滤空项

    if (bookmarkedItems.length === 0) { // 如果没有书签项
      return <p>No typical examples (bookmarked items) yet. Use the star ★ icon to bookmark important examples.</p>; // 返回提示
    }

    return (
        <div className="max-h-screen overflow-auto">
          <table className="w-full border-collapse"> 
            <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Text</th> 
              <th className="border p-2">Status</th> 
              <th className="border p-2">Annotator 1</th> 
              <th className="border p-2">Annotator 2</th> 
              <th className="border p-2">Reviewer Opinion</th> 
              <th className="border p-2">Notes</th> 
              <th className="border p-2">Source</th> 
            </tr>
            </thead>
            <tbody>
            {bookmarkedItems.map((item, index) => { // 遍历书签项
              const opinion = reviewerOpinions[item.text] || {}; // 获取审稿人意见
              const source = sourceInfo[item.text] || ''; // 获取来源信息
              return (
                  <tr
                      key={index}
                      className="cursor-pointer bg-yellow-50 hover:bg-yellow-100"
                      onClick={() => { // 点击时选中并切换视图
                        setSelectedSegment(item.text);
                        setShowTypicalExamplesView(false);
                      }}
                  >
                    <td className="border p-2">{item.text}</td> 
                    <td className="border p-2 text-center">
                      {item.status === 'match' && <span className="text-green-600">Match</span>} 
                      {item.status === 'overlap' && <span className="text-yellow-600">Overlap</span>} 
                      {item.status === 'missing' && <span className="text-red-600">Missing</span>} 
                      {item.status === 'spurious' && <span className="text-blue-600">Spurious</span>} 
                    </td>
                    <td className="border p-2 text-sm">
                      {item.annotator1 ? ( // 标注者1数据
                          <div>
                            <div><strong>Role:</strong> {item.annotator1.role || '-'}</div>
                            <div><strong>Main:</strong> {item.annotator1.mainCategory || '-'}</div>
                            <div><strong>Sub:</strong> {item.annotator1.subCategory || '-'}</div>
                            <div><strong>Polarity:</strong> {item.annotator1.polarity || '-'}</div>
                          </div>
                      ) : 'Not annotated'} 
                    </td>
                    <td className="border p-2 text-sm">
                      {item.annotator2 ? ( // 标注者2数据
                          <div>
                            <div><strong>Role:</strong> {item.annotator2.role || '-'}</div>
                            <div><strong>Main:</strong> {item.annotator2.mainCategory || '-'}</div>
                            <div><strong>Sub:</strong> {item.annotator2.subCategory || '-'}</div>
                            <div><strong>Polarity:</strong> {item.annotator2.polarity || '-'}</div>
                          </div>
                      ) : 'Not annotated'} 
                    </td>
                    <td className="border p-2 text-sm">
                      <div><strong>Role:</strong> {opinion.role || '-'}</div> 
                      <div><strong>Main:</strong> {opinion.mainCategory || '-'}</div> 
                      <div><strong>Sub:</strong> {opinion.subCategory || '-'}</div> 
                      <div><strong>Polarity:</strong> {opinion.polarity || '-'}</div> 
                    </td>
                    <td className="border p-2">{opinion.notes || '-'}</td> 
                    <td className="border p-2">{source || '-'}</td> 
                  </tr>
              );
            })}
            </tbody>
          </table>
        </div>
    );
  };

  // 渲染意见摘要
  const renderOpinionsSummary = () => { // 渲染意见摘要的函数
    const opinions = Object.entries(reviewerOpinions); // 获取所有审稿人意见
    if (opinions.length === 0) return <p>No reviewer opinions yet</p>; // 如果没有意见则返回提示
    const filteredOpinions = showBookmarkedOnly // 筛选意见
        ? opinions.filter(([_, opinion]) => opinion.bookmarked) // 仅显示书签
        : opinions; // 显示全部

    return (
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="space-x-2">
              <button
                  className={`px-3 py-1 rounded ${showBookmarkedOnly ? 'bg-yellow-200' : 'bg-gray-200'}`}
                  onClick={() => setShowBookmarkedOnly(!showBookmarkedOnly)} // 切换显示书签
              >
                {showBookmarkedOnly ? "Show All" : "Show Bookmarked Only"} 
              </button>
              <button
                  className="px-3 py-1 rounded bg-blue-100 hover:bg-blue-200"
                  onClick={() => setShowTypicalExamplesView(!showTypicalExamplesView)} // 切换典型示例视图
              >
                {showTypicalExamplesView ? "Regular View" : "Typical Examples View"} 
              </button>
            </div>
            <span className="text-sm text-gray-600">{filteredOpinions.length} items</span> 
          </div>
          {showTypicalExamplesView ? ( // 如果显示典型示例视图
              renderTypicalExamples() // 渲染典型示例
          ) : (
              <div className="max-h-64 overflow-auto">
                <table className="w-full border-collapse"> 
                  <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2">Text</th> 
                    <th className="border p-2 w-16">Bookmark</th> 
                    <th className="border p-2">Role</th> 
                    <th className="border p-2">Main Category</th> 
                    <th className="border p-2">Sub Category</th> 
                    <th className="border p-2">Polarity</th> 
                    <th className="border p-2">Notes</th> 
                    <th className="border p-2">Source</th> 
                  </tr>
                  </thead>
                  <tbody>
                  {filteredOpinions.map(([text, opinion]) => ( // 遍历筛选后的意见
                      <tr
                          key={text}
                          className={`cursor-pointer hover:bg-blue-50 ${opinion.bookmarked ? 'bg-yellow-50' : ''}`}
                          onClick={() => setSelectedSegment(text)} // 点击时选中
                      >
                        <td className="border p-2 truncate max-w-xs">{text}</td> 
                        <td className="border p-2 text-center text-yellow-500 text-xl">
                          {opinion.bookmarked ? "★" : ""} 
                        </td>
                        <td className="border p-2">{opinion.role || '-'}</td> 
                        <td className="border p-2">{opinion.mainCategory || '-'}</td> 
                        <td className="border p-2">{opinion.subCategory || '-'}</td> 
                        <td className="border p-2">{opinion.polarity || '-'}</td> 
                        <td className="border p-2 truncate max-w-xs">
                          {opinion.notes ? (opinion.notes.length > 20 ? opinion.notes.slice(0, 20) + '...' : opinion.notes) : '-'} 
                        </td>
                        <td className="border p-2 truncate max-w-xs">
                          {sourceInfo[text] ? (sourceInfo[text].length > 15 ? sourceInfo[text].slice(0, 15) + '...' : sourceInfo[text]) : '-'} 
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
          )}
        </div>
    );
  };

  // 文件上传组件
  const FileUpload = ({ label, onUpload, accept, isReady }) => ( // 文件上传组件
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label> 
        <div className="flex items-center">
          <input
              type="file"
              accept={accept} // 文件类型限制
              onChange={onUpload} // 文件变更处理
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {isReady && <span className="text-green-600">✓ Uploaded</span>} 
        </div>
      </div>
  );

  // 渲染标注列表
  const renderAnnotationsList = () => { // 渲染标注列表的函数
    const filtered = showDifferencesOnly ? combinedData.filter(item => item.status !== 'match') : combinedData; // 筛选差异项
    return (
        <div>
          <div className="flex justify-between items-center mb-3">
            <div>
              <label className="flex items-center">
                <input
                    type="checkbox"
                    checked={showDifferencesOnly}
                    onChange={() => setShowDifferencesOnly(!showDifferencesOnly)} // 切换显示差异
                    className="mr-2"
                />
                Show only differences 
              </label>
            </div>
            <span className="text-sm text-gray-600">{filtered.length} items</span> 
          </div>
          <div className="h-64 overflow-auto">
            <table className="w-full border-collapse"> 
              <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Text</th> 
                <th className="border p-2 text-center">Status</th> 
                <th className="border p-2 text-center w-16">Bookmark</th> 
              </tr>
              </thead>
              <tbody>
              {filtered.map((item, idx) => { // 遍历筛选后的数据
                const opinion = reviewerOpinions[item.text] || {}; // 获取审稿人意见
                return (
                    <tr
                        key={idx}
                        className={`cursor-pointer ${selectedSegment === item.text ? 'bg-blue-100' : ''} ${opinion.bookmarked ? 'bg-yellow-50' : ''}`}
                        onClick={() => setSelectedSegment(item.text)} // 点击时选中
                    >
                      <td className="border p-2 truncate max-w-xs">{item.text}</td> 
                      <td className="border p-2 text-center">
                        {item.status === 'match' && <span className="text-green-600">Match</span>} 
                        {item.status === 'overlap' && <span className="text-yellow-600">Overlap</span>} 
                        {item.status === 'missing' && <span className="text-red-600">Missing</span>} 
                        {item.status === 'spurious' && <span className="text-blue-600">Spurious</span>} 
                      </td>
                      <td className="border p-2 text-center text-yellow-500 text-xl">
                        {opinion.bookmarked ? "★" : ""} 
                      </td>
                    </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
    );
  };

  const allFilesReady = filesReady.original && filesReady.annotator1 && filesReady.annotator2; // 检查所有文件是否就绪

  return (
      <div className="min-h-screen bg-gray-100 p-8"> 
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Appraisal Theory Annotation Comparison Tool</h1> 
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <FileUpload
                  label="Upload Original Text (TXT)" // 上传原始文本
                  onUpload={(e) => handleFileUpload(e, 'original')} // 处理上传
                  accept=".txt" // 接受txt文件
                  isReady={filesReady.original} // 文件就绪状态
              />
              <FileUpload
                  label="Upload Annotator 1 CSV" // 上传标注者1 CSV
                  onUpload={(e) => handleFileUpload(e, 'annotator1')} // 处理上传
                  accept=".csv" // 接受csv文件
                  isReady={filesReady.annotator1} // 文件就绪状态
              />
              <FileUpload
                  label="Upload Annotator 2 CSV" // 上传标注者2 CSV
                  onUpload={(e) => handleFileUpload(e, 'annotator2')} // 处理上传
                  accept=".csv" // 接受csv文件
                  isReady={filesReady.annotator2} // 文件就绪状态
              />
            </div>
            {!allFilesReady && ( // 如果文件未全部就绪
                <div className="text-sm text-gray-600 mt-3">
                  <p>File Format Requirements:</p> 
                  <ul className="list-disc ml-5">
                    <li>Original text file: Plain text (.txt)</li> 
                    <li>Annotation files: CSV format with columns for: 
                      <ul className="list-disc ml-5">
                        <li>Selected Text</li> 
                        <li>Appraisal Role</li> 
                        <li>Main Category</li> 
                        <li>Sub Category</li> 
                        <li>Polarity</li> 
                      </ul>
                    </li>
                  </ul>
                </div>
            )}
          </div>
          {error && ( // 如果有错误
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <p className="text-red-700">{error}</p> 
              </div>
          )}
          {allFilesReady && ( // 如果所有文件就绪
              <>
                <div className="bg-white p-4 rounded shadow mb-4">
                  <h2 className="text-lg font-bold mb-2">Statistics</h2> 
                  {renderStatistics()} 
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-lg font-bold mb-2">Original Text with Annotations</h2> 
                    <div className="border p-2 rounded h-64 overflow-auto">
                      {renderAnnotatedText()} 
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="inline-block mr-3"><span className="inline-block w-3 h-3 bg-green-200 mr-1"></span> Match</span> 
                      <span className="inline-block mr-3"><span className="inline-block w-3 h-3 bg-yellow-200 mr-1"></span> Overlap</span> 
                      <span className="inline-block mr-3"><span className="inline-block w-3 h-3 bg-red-200 mr-1"></span> Missing</span> 
                      <span className="inline-block"><span className="inline-block w-3 h-3 bg-blue-200 mr-1"></span> Spurious</span> 
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-lg font-bold mb-2">Annotation Details & Reviewer Opinion</h2> 
                    <div className="h-64 overflow-auto">
                      {renderAnnotationDetails()} 
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded shadow mb-4">
                  <h2 className="text-lg font-bold mb-2">Annotation List</h2> 
                  {renderAnnotationsList()} 
                </div>
                <div className="bg-white p-4 rounded shadow">
                  <h2 className="text-lg font-bold mb-2">Reviewer Opinions Summary</h2> 
                  {renderOpinionsSummary()} 
                </div>
              </>
          )}
          {isLoading && ( // 如果正在加载
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-4 rounded shadow">
                  <p className="text-lg">Processing data, please wait...</p> 
                </div>
              </div>
          )}
        </div>
      </div>
  );
};

export default App; // 导出App组件