import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  TextField,
  Paper,
  IconButton,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  Grid,
  Card,
  CardContent,
  Collapse,
  Chip,
  Stack,
  Tooltip,
  Dialog,
  DialogContent,
  DialogTitle
} from '@mui/material'
import {
  ContentCopy,
  ContentPaste,
  Search,
  History,
  Info,
  ExpandMore,
  ExpandLess,
  PlayArrow,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  Close
} from '@mui/icons-material'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { COMMON_JSONPATH_EXAMPLES, TEST_DATA, QUERY_EXAMPLES } from '../constants'
import { QueryHistory, QueryResult } from '../types'
import { ShareButton } from './ShareButton'

interface QueryPanelProps {
  onSnackbar: (message: string) => void
  initialData?: string | null
}

export function QueryPanel({ onSnackbar, initialData }: QueryPanelProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [queryResults, setQueryResults] = useState<QueryResult[]>([])
  const [queryError, setQueryError] = useState<string | null>(null)
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([])
  const [showGuide, setShowGuide] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [fullscreenZoom, setFullscreenZoom] = useState(1)
  const [selectedResult, setSelectedResult] = useState<QueryResult | null>(null)

  useEffect(() => {
    if (initialData) {
      try {
        const sharedData = JSON.parse(initialData);
        if (sharedData && typeof sharedData === 'object') {
          if (sharedData.data) {
            setInput(sharedData.data);
          }
          
          if (sharedData.query) {
            setQuery(sharedData.query);
          }
          
          if (sharedData.data && sharedData.query) {
            setTimeout(() => {
              executeQuery(sharedData.data, sharedData.query);
            }, 300);
          }
        } else {
          setInput(initialData);
        }
      } catch (err) {
        setQueryError(t('common.error.invalidJson'));
      }
    }
  }, [initialData, t]);

  const executeQuery = (jsonStr: string, queryStr: string) => {
    try {
      if (!jsonStr.trim() || !queryStr.trim()) {
        setQueryError(t('query.invalidQuery'))
        return
      }

      const jsonData = JSON.parse(jsonStr)
      const results: QueryResult[] = []
      
      const evaluateQuery = (data: any, path: string) => {
        if (path === '$') {
          results.push({
            path,
            value: data,
            type: typeof data
          })
          return
        }

        if (path.startsWith('$.')) {
          if (!path.includes('[') && !path.includes('*')) {
            const parts = path.slice(2).split('.')
            let current = data
            let currentPath = '$'
            
            for (const part of parts) {
              if (current === undefined) break
              current = current[part]
              currentPath += `.${part}`
            }
            
            if (current !== undefined) {
              results.push({
                path: currentPath,
                value: current,
                type: typeof current
              })
            }
            return
          }
          
          if (path.includes('[*]')) {
            const basePath = path.split('[*]')[0].slice(2)
            const remainingPath = path.split('[*]').slice(1).join('[*]')
            
            let base = data
            for (const part of basePath.split('.')) {
              if (!part) continue
              base = base[part]
              if (!base) return
            }
            
            if (Array.isArray(base)) {
              if (!remainingPath) {
                base.forEach((item, index) => {
                  results.push({
                    path: `$${basePath ? '.' + basePath : ''}[${index}]`,
                    value: item,
                    type: typeof item
                  })
                })
                return
              }
              
              if (remainingPath.startsWith('.')) {
                const propertyPath = remainingPath.slice(1)
                base.forEach((item, index) => {
                  if (item && typeof item === 'object') {
                    let propertyValue = item
                    let valid = true
                    
                    for (const prop of propertyPath.split('.')) {
                      propertyValue = propertyValue[prop]
                      if (propertyValue === undefined) {
                        valid = false
                        break
                      }
                    }
                    
                    if (valid) {
                      results.push({
                        path: `$${basePath ? '.' + basePath : ''}[${index}].${propertyPath}`,
                        value: propertyValue,
                        type: typeof propertyValue
                      })
                    }
                  }
                })
                return
              }
            }
          }
          
          if (path.match(/\[\d+\]/) && !path.includes('*')) {
            let parts = path.slice(2)
            let current = data
            let currentPath = '$'
            
            const regex = /(.+?)?(\[\d+\])/g
            let match
            let remainder = parts
            
            while ((match = regex.exec(parts)) !== null) {
              const propPath = match[1]
              const arrayAccess = match[2]
              const index = parseInt(arrayAccess.slice(1, -1))
              
              if (propPath) {
                for (const part of propPath.split('.')) {
                  if (!part) continue
                  current = current[part]
                  currentPath += `.${part}`
                  if (current === undefined) break
                }
              }
              
              if (Array.isArray(current) && current.length > index) {
                current = current[index]
                currentPath += `[${index}]`
              } else {
                current = undefined
                break
              }
              
              remainder = parts.slice(match[0].length)
            }
            
            if (current !== undefined && remainder) {
              if (remainder.startsWith('.')) {
                const props = remainder.slice(1).split('.')
                for (const prop of props) {
                  if (!prop) continue
                  current = current[prop]
                  currentPath += `.${prop}`
                  if (current === undefined) break
                }
              }
            }
            
            if (current !== undefined) {
              results.push({
                path: currentPath,
                value: current,
                type: typeof current
              })
            }
            return
          }
          
          const filterRegex = /\$\.(.+?)\[\?\(@\.(.+?)(==|<|>|!=)(.+?)\)\]/
          const match = path.match(filterRegex)
          
          if (match) {
            const basePath = match[1]
            const property = match[2]
            const operator = match[3]
            let value = match[4]
            
            let typedValue: any;
            if (value === 'true') typedValue = true
            else if (value === 'false') typedValue = false
            else if (!isNaN(Number(value))) typedValue = Number(value)
            else typedValue = value.replace(/"/g, '').replace(/'/g, '')
            
            let base = data
            for (const part of basePath.split('.')) {
              if (!part) continue
              base = base[part]
              if (!base) return
            }
            
            if (Array.isArray(base)) {
              base.forEach((item, index) => {
                let matches = false
                
                if (item && typeof item === 'object' && property in item) {
                  const propValue = item[property]
                  
                  switch (operator) {
                    case '==':
                      matches = propValue == typedValue
                      break
                    case '!=':
                      matches = propValue != typedValue
                      break
                    case '>':
                      matches = propValue > typedValue
                      break
                    case '<':
                      matches = propValue < typedValue
                      break
                  }
                  
                  if (matches) {
                    results.push({
                      path: `$.${basePath}[${index}]`,
                      value: item,
                      type: typeof item
                    })
                  }
                }
              })
            }
            return
          }
        }
      }
      
      evaluateQuery(jsonData, queryStr)
      
      if (results.length > 0) {
        setQueryResults(results)
        setQueryError(null)
        
        const newHistoryItem: QueryHistory = {
          query: queryStr,
          timestamp: Date.now(),
          resultCount: results.length
        }
        setQueryHistory(prev => [newHistoryItem, ...prev.slice(0, 9)])
      } else {
        setQueryResults([])
        setQueryError(t('query.noResults'))
      }
    } catch (err) {
      setQueryError(t('query.invalidQuery'))
      setQueryResults([])
    }
  }

  const handleQuery = () => {
    executeQuery(input, query);
  }

  const handlePaste = async (isQuery: boolean) => {
    try {
      const text = await navigator.clipboard.readText()
      if (isQuery) {
        setQuery(text)
      } else {
        setInput(text)
      }
    } catch (err) {
      setQueryError(t('common.error.clipboard'))
    }
  }

  const handleExampleClick = (path: string) => {
    setQuery(path)
    // 使用setTimeout确保在状态更新后执行查询
    setTimeout(() => {
      executeQuery(input, path)
    }, 0)
  }

  const handleLoadTestData = () => {
    const testData = JSON.stringify(TEST_DATA, null, 2)
    setInput(testData)
    onSnackbar(t('query.guide.loadExample'))
  }

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 2))
  }
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.6))
  }
  
  const handleFullscreenZoomIn = () => {
    setFullscreenZoom(prev => Math.min(prev + 0.2, 2))
  }
  
  const handleFullscreenZoomOut = () => {
    setFullscreenZoom(prev => Math.max(prev - 0.2, 0.6))
  }
  
  const handleOpenFullscreen = (result: QueryResult) => {
    setSelectedResult(result)
    setFullscreenZoom(zoomLevel)
    setFullscreenOpen(true)
  }
  
  const handleCloseFullscreen = () => {
    setFullscreenOpen(false)
  }
  
  const handleCopyResult = (result: QueryResult) => {
    navigator.clipboard.writeText(JSON.stringify(result.value, null, 2))
    onSnackbar(t('common.copied', { content: t('query.results') }))
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* SEO Enhancement - Page Description */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          {t('query.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('query.description')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {(() => {
            try {
              const keywords = t('query.keywords', { returnObjects: true });
              if (Array.isArray(keywords)) {
                return keywords.map((keyword, index) => (
                  <Chip 
                    key={index} 
                    label={String(keyword)} 
                    size="small" 
                    variant="outlined" 
                    sx={{ borderRadius: 1 }} 
                  />
                ));
              }
            } catch (error) {
              console.error('Error rendering keywords:', error);
            }
            return null;
          })()}
        </Box>
      </Box>
      
      <Grid container spacing={3}>
        {/* Quick Actions Bar */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                startIcon={<Info />}
                onClick={() => setShowGuide(!showGuide)}
              >
                {showGuide ? t('query.guide.hideGuide') : t('query.guide.showGuide')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlayArrow />}
                onClick={handleLoadTestData}
              >
                {t('query.guide.loadExample')}
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                {t('query.guide.try')}
              </Typography>
            </Stack>
          </Paper>
        </Grid>

        {/* Guide Section */}
        <Grid item xs={12}>
          <Collapse in={showGuide}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                {t('query.guide.title')}
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('query.guide.dataStructure')}
                </Typography>
                <Box sx={{ 
                  overflowX: 'auto',
                  '& pre': {
                    margin: 0,
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxWidth: '100%'
                  }
                }}>
                  <SyntaxHighlighter
                    language="json"
                    style={vscDarkPlus}
                    customStyle={{ 
                      margin: 0, 
                      borderRadius: 4,
                      minWidth: '100%',
                      maxHeight: '150px'
                    }}
                  >
                    {JSON.stringify({
                      store: {
                        book: [
                          {
                            author: 'J.K. Rowling',
                            title: 'Harry Potter',
                            price: 9.99,
                            inStock: true
                          },
                          // 更多图书...
                        ],
                        bicycle: { color: 'red', price: 199.99 }
                      }
                    }, null, 2)}
                  </SyntaxHighlighter>
                </Box>
              </Box>
              
              <Grid container spacing={2}>
                {COMMON_JSONPATH_EXAMPLES.map((example, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          {t(`query.${example.label}`)}
                        </Typography>
                        <Chip
                          label={example.path}
                          size="small"
                          onClick={() => handleExampleClick(example.path)}
                          sx={{ fontFamily: 'monospace', mb: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {example.path === '$' && t('query.guide.returnRoot')}
                          {example.path === '$.store' && t('query.guide.returnStore')}
                          {example.path === '$.store.book[*]' && t('query.guide.returnAllBooks')}
                          {example.path === '$.store.book[0]' && t('query.guide.returnFirstBook')}
                          {example.path === '$.store.book[*].title' && t('query.guide.returnAllTitles')}
                          {example.path === '$.store.book[?(@.inStock==true)]' && t('query.guide.returnInStock')}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('query.guide.syntax')}
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="$"
                      secondary={t('query.guide.root')}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="."
                      secondary={t('query.guide.child')}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="[n]"
                      secondary={t('query.guide.array')}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="[*]"
                      secondary={t('query.guide.allItems')}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary={t('query.guide.filterExample')}
                      secondary={t('query.guide.filter')}
                    />
                  </ListItem>
                </List>
              </Box>
            </Paper>
          </Collapse>
        </Grid>

        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {t('query.jsonData')}
            </Typography>
            <Box sx={{ position: 'relative' }}>
              <TextField
                fullWidth
                multiline
                rows={8}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('format.enterJson')}
                error={!!queryError}
                helperText={queryError}
                sx={{ mb: 2 }}
              />
              <IconButton
                sx={{ position: 'absolute', top: 8, right: 8 }}
                onClick={() => handlePaste(false)}
                size="small"
              >
                <ContentPaste />
              </IconButton>
            </Box>

            <Typography variant="subtitle1" gutterBottom>
              {t('query.jsonPath')}
            </Typography>
            <Box sx={{ position: 'relative' }}>
              <TextField
                fullWidth
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="$.store.book[*].title"
                error={!!queryError}
                sx={{ mb: 2 }}
              />
              <IconButton
                sx={{ position: 'absolute', top: 8, right: 8 }}
                onClick={() => handlePaste(true)}
                size="small"
              >
                <ContentPaste />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<Search />}
                onClick={handleQuery}
                disabled={!input.trim() || !query.trim()}
              >
                {t('query.executeQuery')}
              </Button>
              
              {input && query && (
                <ShareButton 
                  jsonContent={JSON.stringify({
                    data: input,
                    query: query
                  })} 
                  currentTool="query"
                  onSnackbar={onSnackbar}
                />
              )}
            </Box>
          </Paper>

          {/* Results Section */}
          {queryResults.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {t('query.results')} ({queryResults.length})
              </Typography>
              <List>
                {queryResults.map((result, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" color="primary" sx={{ fontFamily: 'monospace' }}>
                          {result.path}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                            {t('query.type')}: {result.type}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                            <Paper 
                              sx={{ 
                                p: 2, 
                                position: 'relative', 
                                flex: 1,
                                overflow: 'hidden'
                              }}
                            >
                              <Box sx={{ 
                                maxHeight: '300px',
                                overflowY: 'auto',
                                overflowX: 'auto',
                                '& pre': {
                                  margin: 0,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  maxWidth: '100%',
                                  transform: `scale(${zoomLevel})`,
                                  transformOrigin: 'top left',
                                  transition: 'transform 0.2s ease'
                                }
                              }}>
                                <SyntaxHighlighter
                                  language="json"
                                  style={vscDarkPlus}
                                  customStyle={{ 
                                    margin: 0, 
                                    borderRadius: 4,
                                    minWidth: '100%'
                                  }}
                                >
                                  {JSON.stringify(result.value, null, 2)}
                                </SyntaxHighlighter>
                              </Box>
                            </Paper>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Tooltip title={t('format.zoomIn')}>
                                <IconButton
                                  onClick={handleZoomIn}
                                  color="primary"
                                  size="small"
                                >
                                  <ZoomIn />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('format.zoomOut')}>
                                <IconButton
                                  onClick={handleZoomOut}
                                  color="primary"
                                  size="small"
                                >
                                  <ZoomOut />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('format.copy')}>
                                <IconButton
                                  onClick={() => handleCopyResult(result)}
                                  color="primary"
                                  size="small"
                                >
                                  <ContentCopy />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('format.fullscreen')}>
                                <IconButton
                                  onClick={() => handleOpenFullscreen(result)}
                                  color="primary"
                                  size="small"
                                >
                                  <Fullscreen />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}

          {/* History Section */}
          {queryHistory.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle1">
                  {t('query.recentQueries')}
                </Typography>
                <IconButton
                  onClick={() => setShowHistory(!showHistory)}
                  size="small"
                >
                  {showHistory ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
              <List dense>
                {queryHistory.slice(0, showHistory ? undefined : 1).map((item, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {item.query}
                        </Typography>
                      }
                      secondary={new Date(item.timestamp).toLocaleString()}
                    />
                    <IconButton
                      onClick={() => {
                        setQuery(item.query)
                        handleQuery()
                        onSnackbar(t('query.executeQuery'))
                      }}
                      size="small"
                    >
                      <History />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Grid>

        {/* Right Column - Examples */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {t('query.examples')}
            </Typography>
            <List>
              {QUERY_EXAMPLES.map((example, index) => {
                const translationKey = `query.${example.label}`;
                return (
                  <ListItem
                    key={index}
                    button
                    onClick={() => handleExampleClick(example.path)}
                    sx={{ mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                  >
                    <ListItemText
                      primary={t(translationKey)}
                      secondary={
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                          {example.path}
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Fullscreen Dialog */}
      <Dialog
        open={fullscreenOpen}
        onClose={handleCloseFullscreen}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: 'background.default',
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{selectedResult?.path || t('query.results')}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={t('format.zoomIn')}>
              <IconButton onClick={handleFullscreenZoomIn} color="primary">
                <ZoomIn />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('format.zoomOut')}>
              <IconButton onClick={handleFullscreenZoomOut} color="primary">
                <ZoomOut />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('format.copy')}>
              <IconButton 
                onClick={() => selectedResult && handleCopyResult(selectedResult)}
                color="primary"
              >
                <ContentCopy />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('common.close')}>
              <IconButton onClick={handleCloseFullscreen} color="primary">
                <Close />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {selectedResult && (
            <Box sx={{ 
              height: '100%',
              overflow: 'auto',
              '& pre': {
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                transform: `scale(${fullscreenZoom})`,
                transformOrigin: 'top left',
                transition: 'transform 0.2s ease'
              }
            }}>
              <SyntaxHighlighter
                language="json"
                style={vscDarkPlus}
                customStyle={{ 
                  margin: 0, 
                  borderRadius: 4,
                  minWidth: '100%'
                }}
              >
                {JSON.stringify(selectedResult.value, null, 2)}
              </SyntaxHighlighter>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
} 