import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  TextField,
  Paper,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  SelectChangeEvent,
  Chip,
  Button,
  Dialog,
  DialogContent,
  DialogTitle
} from '@mui/material'
import {
  ContentCopy,
  ContentPaste,
  SwapHoriz,
  Download,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  Close
} from '@mui/icons-material'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import yaml from 'js-yaml'
import jsontoxml from 'jsontoxml'
import Papa from 'papaparse'
import { ConversionOptions } from '../types'
import { flattenObject, processData } from '../utils/jsonUtils'
import { ShareButton } from './ShareButton'

interface ConvertPanelProps {
  onSnackbar: (message: string) => void
  initialData?: string | null
}

export function ConvertPanel({ onSnackbar, initialData }: ConvertPanelProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('')
  const [convertedOutput, setConvertedOutput] = useState('')
  const [conversionError, setConversionError] = useState<string | null>(null)
  const [conversionType, setConversionType] = useState<'json' | 'yaml' | 'xml' | 'csv'>('json')
  const [indentSize, setIndentSize] = useState('2')
  const [conversionOptions, setConversionOptions] = useState<ConversionOptions>({
    xml: {
      pretty: true,
      indent: '  ',
      header: true
    },
    csv: {
      delimiter: ',',
      header: true,
      flatten: true
    }
  })
  const [zoomLevel, setZoomLevel] = useState(1)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [fullscreenZoom, setFullscreenZoom] = useState(1)

  useEffect(() => {
    if (initialData) {
      try {
        const parsedData = JSON.parse(initialData);
        
        if (parsedData && typeof parsedData === 'object') {
          if (parsedData.source && parsedData.result) {
            setInput(parsedData.source);
            setConvertedOutput(parsedData.result);
            
            if (parsedData.type && ['json', 'yaml', 'xml', 'csv'].includes(parsedData.type)) {
              setConversionType(parsedData.type as 'json' | 'yaml' | 'xml' | 'csv');
            }
            
            if (parsedData.options) {
              setConversionOptions(parsedData.options);
            }
            
            if (parsedData.indentSize) {
              setIndentSize(parsedData.indentSize);
            }
          } else {
            setInput(initialData);
            handleConvertWithData(initialData);
          }
        } else {
          setInput(initialData);
          handleConvertWithData(initialData);
        }
      } catch (err) {
        setInput(initialData);
        handleConvertWithData(initialData);
      }
    }
  }, [initialData]);
  
  const handleConvertWithData = (data: string) => {
    try {
      if (!data.trim()) {
        setConversionError(t('common.error.emptyInput', { content: 'content', action: 'convert' }));
        return;
      }

      if (conversionType === 'json') {
        const jsonData = JSON.parse(data);
        const yamlOutput = yaml.dump(jsonData, {
          indent: parseInt(indentSize),
          lineWidth: -1,
          noRefs: true,
        });
        setConvertedOutput(yamlOutput);
      } else if (conversionType === 'xml') {
        const jsonData = JSON.parse(data);
        const xmlOutput = jsontoxml(jsonData, {
          prettyPrint: conversionOptions.xml.pretty,
          indent: conversionOptions.xml.indent,
          xmlHeader: conversionOptions.xml.header
        });
        setConvertedOutput(xmlOutput);
      } else if (conversionType === 'csv') {
        const jsonData = JSON.parse(data);
        const processedData = conversionOptions.csv.flatten ? 
          [processData(flattenObject(jsonData))] : 
          Array.isArray(jsonData) ? processData(jsonData) : [processData(jsonData)];
        
        const csvOutput = Papa.unparse(processedData, {
          delimiter: conversionOptions.csv.delimiter,
          header: conversionOptions.csv.header
        });
        
        setConvertedOutput(csvOutput);
      } else {
        const jsonData = yaml.load(data);
        const jsonOutput = JSON.stringify(jsonData, null, parseInt(indentSize));
        setConvertedOutput(jsonOutput);
      }
      setConversionError(null);
    } catch (err) {
      setConversionError(t('common.error.invalidJson'));
      setConvertedOutput('');
    }
  };

  const handleConvert = () => {
    handleConvertWithData(input);
  }

  const handleConversionTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newType: 'json' | 'yaml' | 'xml' | 'csv' | null
  ) => {
    if (newType !== null) {
      setConversionType(newType)
      setConvertedOutput('')
      setConversionError(null)
    }
  }

  const handleOptionChange = (format: 'xml' | 'csv', option: string, value: any) => {
    setConversionOptions(prev => ({
      ...prev,
      [format]: {
        ...prev[format],
        [option]: value
      }
    }))
  }

  const handleIndentSizeChange = (event: SelectChangeEvent) => {
    setIndentSize(event.target.value)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInput(text)
    } catch (err) {
      setConversionError(t('common.error.clipboard'));
    }
  }

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(convertedOutput)
    onSnackbar(t('convert.result'))
  }

  const handleDownloadOutput = () => {
    // Implementation for downloading the output
  }

  const handleShare = () => {
    return {
      source: input,
      result: convertedOutput,
      type: conversionType,
      options: conversionOptions,
      indentSize: indentSize
    };
  };

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
  
  const handleOpenFullscreen = () => {
    setFullscreenZoom(zoomLevel)
    setFullscreenOpen(true)
  }
  
  const handleCloseFullscreen = () => {
    setFullscreenOpen(false)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* SEO Enhancement - Page Description */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          {t('convert.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('convert.description')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {(t('convert.keywords', { returnObjects: true }) as string[]).map((keyword: string) => (
            <Chip key={keyword} label={keyword} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
          ))}
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <ToggleButtonGroup
          value={conversionType}
          exclusive
          onChange={handleConversionTypeChange}
          aria-label="conversion type"
        >
          <ToggleButton value="json" aria-label="json to yaml">
            {t('convert.jsonToYaml')}
          </ToggleButton>
          <ToggleButton value="yaml" aria-label="yaml to json">
            {t('convert.yamlToJson')}
          </ToggleButton>
          <ToggleButton value="xml" aria-label="json to xml">
            {t('convert.jsonToXml')}
          </ToggleButton>
          <ToggleButton value="csv" aria-label="json to csv">
            {t('convert.jsonToCsv')}
          </ToggleButton>
        </ToggleButtonGroup>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>{t('format.indent')}</InputLabel>
          <Select
            value={indentSize}
            label={t('format.indent')}
            onChange={handleIndentSizeChange}
            size="small"
          >
            <MenuItem value="2">{t('format.spaces', { count: 2 })}</MenuItem>
            <MenuItem value="4">{t('format.spaces', { count: 4 })}</MenuItem>
            <MenuItem value="8">{t('format.spaces', { count: 8 })}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {(conversionType === 'xml' || conversionType === 'csv') && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('convert.options')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {conversionType === 'xml' && (
              <>
                <FormControl size="small">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={conversionOptions.xml.pretty}
                        onChange={(e) => handleOptionChange('xml', 'pretty', e.target.checked)}
                      />
                    }
                    label={t('convert.prettyPrint')}
                  />
                </FormControl>
                <FormControl size="small">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={conversionOptions.xml.header}
                        onChange={(e) => handleOptionChange('xml', 'header', e.target.checked)}
                      />
                    }
                    label={t('convert.xmlHeader')}
                  />
                </FormControl>
              </>
            )}
            {conversionType === 'csv' && (
              <>
                <FormControl size="small">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={conversionOptions.csv.header}
                        onChange={(e) => handleOptionChange('csv', 'header', e.target.checked)}
                      />
                    }
                    label={t('convert.includeHeader')}
                  />
                </FormControl>
                <FormControl size="small">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={conversionOptions.csv.flatten}
                        onChange={(e) => handleOptionChange('csv', 'flatten', e.target.checked)}
                      />
                    }
                    label={t('convert.flattenObjects')}
                  />
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>{t('convert.delimiter')}</InputLabel>
                  <Select
                    value={conversionOptions.csv.delimiter}
                    label={t('convert.delimiter')}
                    onChange={(e) => handleOptionChange('csv', 'delimiter', e.target.value)}
                    size="small"
                  >
                    <MenuItem value=",">,</MenuItem>
                    <MenuItem value=";">;</MenuItem>
                    <MenuItem value="\t">Tab</MenuItem>
                    <MenuItem value="|">|</MenuItem>
                  </Select>
                </FormControl>
              </>
            )}
          </Box>
        </Paper>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <TextField
            fullWidth
            multiline
            rows={10}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={conversionType === 'yaml' ? t('convert.enterYaml') : t('convert.enterJson')}
            error={!!conversionError}
            helperText={conversionError}
            sx={{ flex: 1 }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1 }}>
            <Tooltip title={t('format.paste')}>
              <IconButton onClick={handlePaste} color="primary">
                <ContentPaste />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('convert.convert')}>
              <IconButton onClick={handleConvert} color="primary">
                <SwapHoriz />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<SwapHoriz />}
            onClick={handleConvert}
            sx={{ 
              px: 6, 
              py: 1.5, 
              fontWeight: 'bold', 
              borderRadius: 2,
              boxShadow: 3,
              fontSize: '1.1rem'
            }}
          >
            {t('convert.convert')}
          </Button>
        </Box>

        {convertedOutput && (
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
                maxHeight: '500px',
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
                  language={conversionType === 'yaml' ? 'yaml' : 
                           conversionType === 'xml' ? 'xml' : 
                           conversionType === 'csv' ? 'text' : 'json'}
                  style={vscDarkPlus}
                  customStyle={{ 
                    margin: 0, 
                    borderRadius: 4,
                    minWidth: '100%'
                  }}
                >
                  {convertedOutput}
                </SyntaxHighlighter>
              </Box>
            </Paper>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Tooltip title={t('format.zoomIn')}>
                <IconButton
                  onClick={handleZoomIn}
                  color="primary"
                >
                  <ZoomIn />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('format.zoomOut')}>
                <IconButton
                  onClick={handleZoomOut}
                  color="primary"
                >
                  <ZoomOut />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('format.copy')}>
                <IconButton
                  onClick={handleCopyOutput}
                  color="primary"
                >
                  <ContentCopy />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('format.fullscreen')}>
                <IconButton
                  onClick={handleOpenFullscreen}
                  color="primary"
                >
                  <Fullscreen />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </Box>

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
          <Typography variant="h6">{t('convert.title')}</Typography>
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
                onClick={handleCopyOutput}
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
              language={conversionType === 'yaml' ? 'yaml' : 
                       conversionType === 'xml' ? 'xml' : 
                       conversionType === 'csv' ? 'text' : 'json'}
              style={vscDarkPlus}
              customStyle={{ 
                margin: 0, 
                borderRadius: 4,
                minWidth: '100%'
              }}
            >
              {convertedOutput}
            </SyntaxHighlighter>
          </Box>
        </DialogContent>
      </Dialog>

      {/* 输出结果 */}
      {convertedOutput && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6"></Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download />}
                onClick={handleDownloadOutput}
              >
                {t('format.download')}
              </Button>
              <ShareButton 
                jsonContent={JSON.stringify(handleShare())} 
                currentTool="convert"
                onSnackbar={onSnackbar}
              />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
} 