import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  TextField,
  Paper,
  IconButton,
  Tooltip,
  Button,
  List,
  ListItem,
  ListItemText,
  Collapse,
  Typography,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack
} from '@mui/material'
import {
  ContentCopy,
  ContentPaste,
  ExpandMore,
  ExpandLess,
  Check,
  Error as ErrorIcon,
  PlayArrow,
  Article,
  FormatListBulleted} from '@mui/icons-material'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { ShareButton } from './ShareButton'

// Schema templates
const SCHEMA_TEMPLATES = [
  {
    id: 'genericObject',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        email: { type: 'string', format: 'email' }
      },
      required: ['name', 'age']
    }
  },
  {
    id: 'userList',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          active: { type: 'boolean' }
        },
        required: ['id', 'name']
      }
    }
  },
  {
    id: 'configObject',
    schema: {
      type: 'object',
      properties: {
        appName: { type: 'string' },
        version: { type: 'string' },
        settings: {
          type: 'object',
          properties: {
            darkMode: { type: 'boolean' },
            notifications: { type: 'boolean' },
            language: { 
              type: 'string',
              enum: ['en', 'es', 'fr', 'zh']
            }
          }
        }
      },
      required: ['appName', 'version']
    }
  }
]

// Example data
const DATA_EXAMPLES = [
  {
    id: 'genericObject',
    data: {
      name: "John Doe",
      age: 30,
      email: "john.doe@example.com"
    }
  },
  {
    id: 'userList',
    data: [
      { id: 1, name: "John", email: "john@example.com", active: true },
      { id: 2, name: "Jane", email: "jane@example.com", active: false }
    ]
  },
  {
    id: 'configObject',
    data: {
      appName: "MyApp",
      version: "1.0.0",
      settings: {
        darkMode: true,
        notifications: false,
        language: "en"
      }
    }
  }
]

interface ValidationErrorDetails {
  path: string
  message: string
  keyword: string
  params: Record<string, any>
  data?: any
}

interface SchemaValidationPanelProps {
  onSnackbar: (message: string) => void
  initialData?: string | null
}

export function SchemaValidationPanel({ onSnackbar, initialData }: SchemaValidationPanelProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('')
  const [schemaInput, setSchemaInput] = useState('')
  const [validationErrors, setValidationErrors] = useState<ValidationErrorDetails[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [, setShowValidationErrors] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [selectedErrorPath, setSelectedErrorPath] = useState<string | null>(null)
  const [selectedDataExample, setSelectedDataExample] = useState<number | ''>('')
  const [selectedSchemaTemplate, setSelectedSchemaTemplate] = useState<number | ''>('')
  
  // 处理分享链接传入的初始数据
  useEffect(() => {
    if (initialData) {
      try {
        // 尝试解析共享数据，格式应该是 { data: '...', schema: '...' }
        const sharedData = JSON.parse(initialData);
        if (sharedData && typeof sharedData === 'object') {
          if (sharedData.data) {
            setInput(sharedData.data);
          }
          
          if (sharedData.schema) {
            setSchemaInput(sharedData.schema);
          }
          
          // 如果同时有数据和schema，自动进行验证
          if (sharedData.data && sharedData.schema) {
            validateJsonData(sharedData.data, sharedData.schema);
          }
        } else {
          // 如果只是一个普通的JSON对象，将其作为数据填入
          setInput(initialData);
        }
      } catch (err) {
        setValidationError(t('common.error.invalidJson'));
      }
    }
  }, [initialData, t]);
  
  // 验证JSON数据的函数
  const validateJsonData = (jsonData: string, schema: string) => {
    try {
      const parsedData = JSON.parse(jsonData);
      const parsedSchema = JSON.parse(schema);
      
      const ajv = new Ajv({ 
        allErrors: true,
        verbose: true
      });
      addFormats(ajv);
      
      const validate = ajv.compile(parsedSchema);
      const valid = validate(parsedData);
      
      if (valid) {
        setValidationErrors([]);
        setValidationError(null);
        setIsValid(true);
      } else {
        const errors = validate.errors?.map(error => {
          let dataValue;
          if (error.instancePath) {
            try {
              const path = error.instancePath.split('/').filter(p => p);
              let current = parsedData;
              for (const segment of path) {
                current = current[segment];
              }
              dataValue = current;
            } catch (e) {
              dataValue = error.data;
            }
          } else {
            dataValue = error.data || parsedData;
          }
          
          return {
            path: error.instancePath || 'root',
            message: error.message || t('validate.invalidValue'),
            keyword: error.keyword,
            params: error.params,
            data: dataValue
          };
        }) || [];
        
        setValidationErrors(errors as ValidationErrorDetails[]);
        setValidationError(t('validate.jsonInvalid'));
        setIsValid(false);
        setShowValidationErrors(true);
      }
    } catch (err) {
      setValidationError(`${t('common.error.invalidJson')}: ${err instanceof Error ? err.message : t('validate.invalidFormat')}`);
      setValidationErrors([]);
      setIsValid(false);
    }
  };

  // 验证处理逻辑
  const handleValidate = () => {
    if (!input.trim() || !schemaInput.trim()) {
      setValidationError(t('validate.enterBoth'));
      return;
    }
    
    validateJsonData(input, schemaInput);
  }

  // Load template
  const handleLoadTemplate = (index: number) => {
    setSchemaInput(JSON.stringify(SCHEMA_TEMPLATES[index].schema, null, 2));
    setSelectedSchemaTemplate(index);
    
    // Automatically load corresponding example data
    if (SCHEMA_TEMPLATES[index].id === DATA_EXAMPLES[index].id) {
      setInput(JSON.stringify(DATA_EXAMPLES[index].data, null, 2));
      setSelectedDataExample(index);
      onSnackbar(t('validate.templateDataLoaded', { name: t(`validate.templateExamples.${SCHEMA_TEMPLATES[index].id}`) }));
    } else {
      onSnackbar(t('validate.templateLoaded'));
    }
  }
  
  // Load example data
  const handleLoadExample = (index: number) => {
    setInput(JSON.stringify(DATA_EXAMPLES[index].data, null, 2));
    setSelectedDataExample(index);
    
    // Automatically load corresponding schema template
    if (DATA_EXAMPLES[index].id === SCHEMA_TEMPLATES[index].id) {
      setSchemaInput(JSON.stringify(SCHEMA_TEMPLATES[index].schema, null, 2));
      setSelectedSchemaTemplate(index);
      onSnackbar(t('validate.dataTemplateLoaded', { name: t(`validate.templateExamples.${DATA_EXAMPLES[index].id}`) }));
    } else {
      onSnackbar(t('validate.dataLoaded'));
    }
  }

  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    onSnackbar(t('common.copied', { content: t('validate.validationResult') }));
  }
  
  // Helper function for error details
  
  // Highlight data with error

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* SEO Enhancement - Page Description */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          {t('validate.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('validate.description')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {(t('validate.keywords', { returnObjects: true }) as string[]).map((keyword: string) => (
            <Chip key={keyword} label={keyword} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
          ))}
        </Box>
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {t('validate.jsonData')}
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                  <InputLabel>{t('validate.dataExamples')}</InputLabel>
                  <Select
                    value={selectedDataExample}
                    label={t('validate.dataExamples')}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value !== '') {
                        handleLoadExample(value as number);
                      }
                    }}
                  >
                    <MenuItem value="">{t('validate.selectExample')}</MenuItem>
                    {DATA_EXAMPLES.map((example, index) => (
                      <MenuItem key={index} value={index}>
                        {t(`validate.templateExamples.${example.id}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={10}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('validate.enterJsonData')}
                  error={!!validationError}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Tooltip title={t('format.paste')}>
                    <IconButton 
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText()
                          setInput(text)
                        } catch (err) {
                          onSnackbar(t('common.error.clipboard'))
                        }
                      }}
                    >
                      <ContentPaste />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {t('validate.jsonSchema')}
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                  <InputLabel>{t('validate.schemaTemplates')}</InputLabel>
                  <Select
                    value={selectedSchemaTemplate}
                    label={t('validate.schemaTemplates')}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value !== '') {
                        handleLoadTemplate(value as number);
                      }
                    }}
                  >
                    <MenuItem value="">{t('validate.selectTemplate')}</MenuItem>
                    {SCHEMA_TEMPLATES.map((template, index) => (
                      <MenuItem key={index} value={index}>
                        {t(`validate.templateExamples.${template.id}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={10}
                  value={schemaInput}
                  onChange={(e) => setSchemaInput(e.target.value)}
                  placeholder={t('validate.enterJsonSchema')}
                  error={!!validationError}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Tooltip title={t('format.paste')}>
                    <IconButton 
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText()
                          setSchemaInput(text)
                        } catch (err) {
                          onSnackbar(t('common.error.clipboard'))
                        }
                      }}
                    >
                      <ContentPaste />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
      
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleValidate}
          startIcon={<PlayArrow />}
          disabled={!input.trim() || !schemaInput.trim()}
          sx={{ minWidth: 150 }}
        >
          {t('validate.validate')}
        </Button>
      </Box>
      
      {/* 添加分享按钮 */}
      {input && schemaInput && (
        <ShareButton 
          jsonContent={JSON.stringify({
            data: input,
            schema: schemaInput
          })} 
          currentTool="validate"
          onSnackbar={onSnackbar}
        />
      )}
      
      {isValid !== null && (
        <Paper sx={{ p: 2, borderLeft: 5, borderColor: isValid ? 'success.main' : 'error.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            {isValid ? (
              <Check color="success" sx={{ mr: 1 }} />
            ) : (
              <ErrorIcon color="error" sx={{ mr: 1 }} />
            )}
            <Typography 
              variant="subtitle1" 
              color={isValid ? 'success.main' : 'error.main'}
              sx={{ fontWeight: 'bold' }}
            >
              {isValid ? t('validate.validResult') : t('validate.invalidResult')}
            </Typography>
            <IconButton 
              size="small" 
              sx={{ ml: 'auto' }} 
              onClick={() => handleCopy(JSON.stringify(validationErrors, null, 2))}
            >
              <ContentCopy fontSize="small" />
            </IconButton>
          </Box>
          
          {!isValid && validationErrors.length > 0 && (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('validate.errorsFound', { count: validationErrors.length })}
              </Typography>
              
              <List sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {validationErrors.map((error, index) => (
                  <ListItem 
                    key={index}
                    divider={index < validationErrors.length - 1}
                    button
                    onClick={() => {
                      setSelectedErrorPath(selectedErrorPath === error.path ? null : error.path)
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {t('validate.atPath')} <code>{error.path}</code>
                        </Typography>
                      }
                      secondary={
                        <Typography variant="body2" color="error" component="span">
                          {error.message}
                        </Typography>
                      }
                    />
                    {selectedErrorPath === error.path ? <ExpandLess /> : <ExpandMore />}
                  </ListItem>
                ))}
              </List>
              
              {/* Error Details Expansion */}
              {validationErrors.map((error, index) => (
                <Collapse key={index} in={selectedErrorPath === error.path} timeout="auto">
                  <Card variant="outlined" sx={{ mt: 1, mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        {t('validate.errorDetails')}
                      </Typography>
                      <Stack spacing={1}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('validate.errorType')}
                          </Typography>
                          <Typography variant="body2">
                            {error.keyword}
                          </Typography>
                        </Box>
                        
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('validate.path')}
                          </Typography>
                          <Typography variant="body2">
                            <code>{error.path}</code>
                          </Typography>
                        </Box>
                        
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('validate.message')}
                          </Typography>
                          <Typography variant="body2">
                            {error.message}
                          </Typography>
                        </Box>
                        
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('validate.receivedValue')}
                          </Typography>
                          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                            {typeof error.data === 'object' 
                              ? JSON.stringify(error.data)
                              : String(error.data)
                            }
                          </Typography>
                        </Box>
                        
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('validate.expectedSchema')}
                          </Typography>
                          <Typography variant="body2">
                            {error.params && JSON.stringify(error.params)}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Collapse>
              ))}
            </>
          )}
        </Paper>
      )}
      
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {t('validate.learnJsonSchema')}
            </Typography>
            <Typography variant="body2" paragraph>
              {t('validate.schemaDescription')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button 
                variant="outlined" 
                size="small" 
                component="a" 
                href="https://json-schema.org/understanding-json-schema/index.html" 
                target="_blank"
                startIcon={<Article />}
              >
                {t('validate.documentation')}
              </Button>
              <Button 
                variant="outlined" 
                size="small" 
                component="a" 
                href="https://json-schema.org/learn/getting-started-step-by-step.html" 
                target="_blank"
                startIcon={<FormatListBulleted />}
              >
                {t('validate.tutorial')}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
} 