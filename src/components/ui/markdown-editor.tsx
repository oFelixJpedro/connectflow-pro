import { useCallback, useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Smile,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SlashCommandPicker, SlashCommand, SLASH_COMMANDS } from '@/components/ai-agents/SlashCommandPicker';
import {
  TagSelector,
  AIAgentSelector,
  UserSelector,
  CRMStageSelector,
  DepartmentSelector,
  TextInputSelector,
} from '@/components/ai-agents/slash-commands';
import { SlashCommandMark } from './slash-command-mark';

// Emoji categories for the picker
const emojiCategories = [
  {
    name: 'Expressões',
    icon: '😀',
    emojis: ['😀', '😂', '😍', '😢', '😮', '😡', '🤔', '😴', '🙂', '😊', '😉', '🥰'],
  },
  {
    name: 'Símbolos',
    icon: '❤️',
    emojis: ['❤️', '👍', '👏', '🙏', '✅', '❌', '⭐', '🔥', '💪', '👀', '💡', '⚠️'],
  },
  {
    name: 'Comunicação',
    icon: '💬',
    emojis: ['💬', '💭', 'ℹ️', '❓', '📝', '📌', '🎯', '📢', '🔔', '📞', '✉️', '📧'],
  },
];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  enableSlashCommands?: boolean;
  connectionId?: string;
  agentId?: string;
}

// Convert Markdown to HTML for the editor
function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  let html = markdown;
  
  // Headers
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Underline (HTML tag)
  html = html.replace(/<u>(.+?)<\/u>/g, '<u>$1</u>');
  
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  
  // Slash commands - wrap with span
  // Note: values can include "/" (e.g. tag names like "Auxdlio/Acidente"), so we match until whitespace.
  html = html.replace(/(\/[a-z_]+:[^\s]+)/g, '<span data-slash-command="true" class="slash-command-badge">$1</span>');
  html = html.replace(/(\/desativar_agente)(?![:\w])/g, '<span data-slash-command="true" class="slash-command-badge">$1</span>');
  
  // Ordered lists (before converting to paragraphs)
  const orderedListPattern = /(?:^|\n)((?:\d+\. .+\n?)+)/g;
  html = html.replace(orderedListPattern, (match, listContent) => {
    const items = listContent.trim().split('\n').map((item: string) => {
      const text = item.replace(/^\d+\. /, '');
      return `<li>${text}</li>`;
    }).join('');
    return `<ol>${items}</ol>`;
  });
  
  // Unordered lists
  const unorderedListPattern = /(?:^|\n)((?:- .+\n?)+)/g;
  html = html.replace(unorderedListPattern, (match, listContent) => {
    const items = listContent.trim().split('\n').map((item: string) => {
      const text = item.replace(/^- /, '');
      return `<li>${text}</li>`;
    }).join('');
    return `<ul>${items}</ul>`;
  });
  
  // Line breaks to paragraphs (but not inside lists)
  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;
  
  for (const line of lines) {
    if (line.startsWith('<ul>') || line.startsWith('<ol>')) {
      inList = true;
      result.push(line);
    } else if (line.includes('</ul>') || line.includes('</ol>')) {
      inList = false;
      result.push(line);
    } else if (!inList && line.trim() && !line.startsWith('<h')) {
      result.push(`<p>${line}</p>`);
    } else {
      result.push(line);
    }
  }
  
  return result.join('');
}

// Convert HTML from the editor to Markdown
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  
  let markdown = html;
  
  // Headers
  markdown = markdown.replace(/<h1[^>]*>(.+?)<\/h1>/g, '# $1\n');
  markdown = markdown.replace(/<h2[^>]*>(.+?)<\/h2>/g, '## $1\n');
  
  // Bold
  markdown = markdown.replace(/<strong>(.+?)<\/strong>/g, '**$1**');
  markdown = markdown.replace(/<b>(.+?)<\/b>/g, '**$1**');
  
  // Italic
  markdown = markdown.replace(/<em>(.+?)<\/em>/g, '*$1*');
  markdown = markdown.replace(/<i>(.+?)<\/i>/g, '*$1*');
  
  // Underline
  markdown = markdown.replace(/<u>(.+?)<\/u>/g, '<u>$1</u>');
  
  // Strikethrough
  markdown = markdown.replace(/<s>(.+?)<\/s>/g, '~~$1~~');
  markdown = markdown.replace(/<strike>(.+?)<\/strike>/g, '~~$1~~');
  markdown = markdown.replace(/<del>(.+?)<\/del>/g, '~~$1~~');
  
  // Remove slash command spans (keep content)
  markdown = markdown.replace(/<span[^>]*data-slash-command[^>]*>([^<]+)<\/span>/g, '$1');
  
  // Unordered lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (match, content) => {
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [];
    return items.map((item: string) => {
      const text = item.replace(/<li[^>]*>|<\/li>/g, '').trim();
      return `- ${text}`;
    }).join('\n') + '\n';
  });
  
  // Ordered lists
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, (match, content) => {
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [];
    return items.map((item: string, index: number) => {
      const text = item.replace(/<li[^>]*>|<\/li>/g, '').trim();
      return `${index + 1}. ${text}`;
    }).join('\n') + '\n';
  });
  
  // Paragraphs to line breaks
  markdown = markdown.replace(/<p[^>]*>/g, '');
  markdown = markdown.replace(/<\/p>/g, '\n');
  
  // Remove other HTML tags
  markdown = markdown.replace(/<br\s*\/?>/g, '\n');
  markdown = markdown.replace(/<[^>]+>/g, '');
  
  // Clean up multiple newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, ' ');
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  
  return markdown.trim();
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, disabled, tooltip, children }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'h-8 w-8 p-0',
            isActive && 'bg-accent text-accent-foreground'
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

// Helper to parse command from text
function parseCommand(commandText: string): { commandId: string; value: string } | null {
  // Match /command_name:value or /command_name
  const match = commandText.match(/^\/([a-z_]+):?(.*)$/);
  if (!match) return null;
  
  const commandName = match[1];
  const value = match[2] || '';
  
  // Map command names to IDs
  const commandMap: Record<string, string> = {
    'adicionar_etiqueta': 'add_tag',
    'transferir_agente': 'transfer_agent',
    'transferir_usuario': 'transfer_user',
    'atribuir_origem': 'set_origin',
    'mudar_etapa_crm': 'change_crm_stage',
    'notificar_equipe': 'notify_team',
    'atribuir_departamento': 'assign_department',
    'desativar_agente': 'deactivate_agent',
  };
  
  const commandId = commandMap[commandName];
  if (!commandId) return null;
  
  return { commandId, value };
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Digite aqui...',
  minHeight = '300px',
  className,
  enableSlashCommands = false,
  connectionId,
  agentId,
}: MarkdownEditorProps) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const isExternalUpdate = useRef(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  
  // Slash command state
  const [showSlashPicker, setShowSlashPicker] = useState(false);
  const [slashPosition, setSlashPosition] = useState({ x: 0, y: 0 });
  const [selectedCommand, setSelectedCommand] = useState<SlashCommand | null>(null);
  const [slashSearchTerm, setSlashSearchTerm] = useState('');
  
  // Editing existing command state
  const [editingCommand, setEditingCommand] = useState<{
    from: number;
    to: number;
    command: SlashCommand;
    currentValue: string;
  } | null>(null);
  
  // Ref to always have the latest editingCommand value (avoids stale closure)
  const editingCommandRef = useRef<typeof editingCommand>(null);

  // Handle delete command via X button (uses ref to avoid circular dependency)
  const handleCommandDelete = useCallback((from: number, to: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    
    ed.chain()
      .focus()
      .setTextSelection({ from, to })
      .deleteSelection()
      .run();
  }, []);

  // Handle click on existing command - opens main picker to allow category change
  const handleCommandClick = useCallback((commandText: string, from: number, to: number) => {
    const parsed = parseCommand(commandText);
    if (!parsed) return;
    
    const command = SLASH_COMMANDS.find(c => c.id === parsed.commandId);
    if (!command) return;
    
    // Get position for picker
    const containerRect = editorContainerRef.current?.getBoundingClientRect();
    if (containerRect) {
      setSlashPosition({
        x: 20,
        y: 100,
      });
    }
    
    const editingData = {
      from,
      to,
      command,
      currentValue: parsed.value,
    };
    
    setEditingCommand(editingData);
    editingCommandRef.current = editingData;
    
    // Show MAIN picker (not submenu) so user can change category
    setSelectedCommand(null);
    setShowSlashPicker(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      SlashCommandMark.configure({
        onCommandClick: enableSlashCommands ? handleCommandClick : undefined,
        onCommandDelete: enableSlashCommands ? handleCommandDelete : undefined,
      }),
    ],
    content: markdownToHtml(value),
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
          'prose-headings:font-semibold prose-headings:text-foreground',
          'prose-h1:text-xl prose-h1:mb-3 prose-h1:mt-4',
          'prose-h2:text-lg prose-h2:mb-2 prose-h2:mt-3',
          'prose-p:text-foreground prose-p:my-1.5',
          'prose-strong:text-foreground prose-strong:font-semibold',
          'prose-em:text-foreground',
          'prose-ul:my-2 prose-ol:my-2',
          'prose-li:my-0.5'
        ),
        style: `min-height: ${minHeight}; padding: 12px;`,
      },
      handleKeyDown: (view, event) => {
        // Detect "/" key for slash commands
        if (enableSlashCommands && event.key === '/') {
          // Get cursor position in the editor
          const { from } = view.state.selection;
          const coords = view.coordsAtPos(from);
          
          // Get container position for relative positioning
          const containerRect = editorContainerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setSlashPosition({
              x: coords.left - containerRect.left,
              y: coords.bottom - containerRect.top,
            });
          }
          
          setSlashSearchTerm('');
          setShowSlashPicker(true);
          // Don't prevent default - let "/" be typed
          return false;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (isExternalUpdate.current) return;
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
      
      // Check if we should close slash picker (e.g., user deleted the "/")
      if (showSlashPicker) {
        const text = editor.getText();
        const lastSlashIndex = text.lastIndexOf('/');
        if (lastSlashIndex === -1) {
          setShowSlashPicker(false);
        }
      }
    },
  });

  // Store editor in ref for callbacks that need it before declaration
  editorRef.current = editor;

  // Sync external value changes (e.g., "Texto Padrão" button)
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const currentMarkdown = htmlToMarkdown(editor.getHTML());
      if (value !== currentMarkdown) {
        isExternalUpdate.current = true;
        editor.commands.setContent(markdownToHtml(value));
        isExternalUpdate.current = false;
      }
    }
  }, [value, editor]);

  const insertEmoji = useCallback((emoji: string) => {
    if (editor) {
      editor.chain().focus().insertContent(emoji).run();
      setEmojiOpen(false);
    }
  }, [editor]);

  // Handle slash command selection
  const handleCommandSelect = useCallback((command: SlashCommand) => {
    const editing = editingCommandRef.current;
    
    if (command.needsSelection) {
      // Open submenu - editingCommand ref is preserved for handleSubMenuSelect
      setSelectedCommand(command);
      setShowSlashPicker(false);
    } else {
      // Command without submenu (e.g., /desativar_agente)
      if (editor) {
        if (editing) {
          // Delete old command first, then insert new
          editor.chain()
            .focus()
            .setTextSelection({ from: editing.from, to: editing.to })
            .deleteSelection()
            .run();
          
          window.setTimeout(() => {
            editor.chain()
              .focus()
              .setTextSelection(editing.from)
              .insertContent({
                type: 'text',
                text: command.insertText,
                marks: [{ type: 'slashCommand' }],
              })
              .run();
            
            setEditingCommand(null);
            editingCommandRef.current = null;
          }, 10);
        } else {
          // New command - just insert
          editor.chain()
            .focus()
            .insertContent({
              type: 'text',
              text: command.insertText,
              marks: [{ type: 'slashCommand' }],
            })
            .run();
        }
      }
      setShowSlashPicker(false);
    }
  }, [editor]);

  // Handle submenu value selection - insert with visual styling
  const handleSubMenuSelect = useCallback((value: string) => {
    if (!editor || !selectedCommand) return;
    
    // Use ref to get the latest editing state
    const editing = editingCommandRef.current;
    
    // Build the new command using SELECTED command (not old editing command)
    const fullCommand = `${selectedCommand.insertText}${value}`;
    
    if (editing) {
      // Editing existing command - DELETE FIRST, then INSERT
      const insertPosition = editing.from;
      const ed = editor;
      
      // STEP 1: Delete the old command completely
      ed.chain()
        .focus()
        .setTextSelection({ from: editing.from, to: editing.to })
        .deleteSelection()
        .run();

      // STEP 2: Insert after deletion commits (tiny delay to avoid ProseMirror timing issues)
      window.setTimeout(() => {
        ed.chain()
          .focus()
          .setTextSelection(insertPosition)
          .insertContent({
            type: 'text',
            text: fullCommand,
            marks: [{ type: 'slashCommand' }],
          })
          .run();

        setEditingCommand(null);
        editingCommandRef.current = null;
      }, 10);
    } else {
      // New command - just insert
      editor.chain()
        .focus()
        .insertContent({
          type: 'text',
          text: fullCommand,
          marks: [{ type: 'slashCommand' }],
        })
        .run();
    }
    setSelectedCommand(null);
  }, [editor, selectedCommand]); // Removed editingCommand from deps - using ref instead

  const closeAllPickers = useCallback(() => {
    setShowSlashPicker(false);
    setSelectedCommand(null);
    setEditingCommand(null);
    editingCommandRef.current = null;
  }, []);

  // Handle back button - return to main picker
  const handleBackToMainPicker = useCallback(() => {
    setSelectedCommand(null);
    setEditingCommand(null);
    editingCommandRef.current = null;
    setShowSlashPicker(true);
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <div ref={editorContainerRef} className={cn('relative border border-input rounded-lg overflow-hidden bg-background', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 border-b border-input bg-muted/30 flex-wrap">
        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          tooltip="Título (H1)"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          tooltip="Subtítulo (H2)"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          tooltip="Negrito (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          tooltip="Itálico (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          tooltip="Sublinhado (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          tooltip="Riscado"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          tooltip="Lista com marcadores"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          tooltip="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Emoji */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Inserir emoji
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-[280px] p-3" side="bottom" align="start">
            <div className="space-y-3">
              {emojiCategories.map((category) => (
                <div key={category.name}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">{category.icon}</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {category.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {category.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className={cn(
                          'text-xl p-1.5 rounded-md transition-all duration-150',
                          'hover:bg-accent hover:scale-110',
                          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                          'active:scale-95'
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Slash Command Picker */}
      {enableSlashCommands && showSlashPicker && (
        <SlashCommandPicker
          position={slashPosition}
          onSelect={handleCommandSelect}
          onClose={() => setShowSlashPicker(false)}
          searchTerm={slashSearchTerm}
        />
      )}

      {/* Submenus with back button */}
      {enableSlashCommands && selectedCommand?.id === 'add_tag' && (
        <TagSelector
          position={slashPosition}
          onSelect={handleSubMenuSelect}
          onClose={closeAllPickers}
          onBack={handleBackToMainPicker}
        />
      )}
      
      {enableSlashCommands && selectedCommand?.id === 'transfer_agent' && (
        <AIAgentSelector
          position={slashPosition}
          onSelect={handleSubMenuSelect}
          onClose={closeAllPickers}
          onBack={handleBackToMainPicker}
          currentAgentId={agentId}
        />
      )}
      
      {enableSlashCommands && selectedCommand?.id === 'transfer_user' && (
        <UserSelector
          position={slashPosition}
          onSelect={handleSubMenuSelect}
          onClose={closeAllPickers}
          onBack={handleBackToMainPicker}
        />
      )}
      
      {enableSlashCommands && selectedCommand?.id === 'set_origin' && (
        <TextInputSelector
          position={slashPosition}
          onSelect={handleSubMenuSelect}
          onClose={closeAllPickers}
          onBack={handleBackToMainPicker}
          title="Atribuir Origem"
          placeholder="Ex: Google Ads, Facebook, Indicação..."
        />
      )}
      
      {enableSlashCommands && selectedCommand?.id === 'change_crm_stage' && (
        <CRMStageSelector
          position={slashPosition}
          onSelect={handleSubMenuSelect}
          onClose={closeAllPickers}
          onBack={handleBackToMainPicker}
          connectionId={connectionId}
        />
      )}
      
      {enableSlashCommands && selectedCommand?.id === 'notify_team' && (
        <TextInputSelector
          position={slashPosition}
          onSelect={handleSubMenuSelect}
          onClose={closeAllPickers}
          onBack={handleBackToMainPicker}
          title="Notificar Equipe"
          placeholder="Digite a mensagem de notificação..."
          multiline
        />
      )}
      
      {enableSlashCommands && selectedCommand?.id === 'assign_department' && (
        <DepartmentSelector
          position={slashPosition}
          onSelect={handleSubMenuSelect}
          onClose={closeAllPickers}
          onBack={handleBackToMainPicker}
          connectionId={connectionId}
        />
      )}

      {/* Styles for placeholder and slash commands */}
      <style>{`
        .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
        .ProseMirror {
          outline: none;
        }
        .ProseMirror h1 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          margin-top: 1rem;
        }
        .ProseMirror h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          margin-top: 0.75rem;
        }
        .ProseMirror p {
          margin: 0.375rem 0;
        }
        .ProseMirror ul {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
          list-style-type: disc;
        }
        .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
          list-style-type: decimal;
        }
        .ProseMirror li {
          margin: 0.25rem 0;
          display: list-item;
        }
        .ProseMirror u {
          text-decoration: underline;
        }
        
        /* Slash command badge styling */
        .slash-command-badge {
          display: inline-flex;
          align-items: center;
          position: relative;
          background-color: hsl(var(--primary) / 0.15);
          color: hsl(var(--primary));
          padding: 2px 24px 2px 8px;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 0.85em;
          cursor: pointer;
          border: 1px solid hsl(var(--primary) / 0.3);
          transition: all 0.15s ease;
          margin: 0 2px;
        }
        
        .slash-command-badge::after {
          content: '×';
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          font-weight: bold;
          color: hsl(var(--muted-foreground));
          opacity: 0.5;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.15s ease;
        }
        
        .slash-command-badge:hover::after {
          opacity: 1;
          color: hsl(var(--destructive));
          background-color: hsl(var(--destructive) / 0.15);
        }
        
        .slash-command-badge:hover {
          background-color: hsl(var(--primary) / 0.25);
          border-color: hsl(var(--primary) / 0.5);
        }
        
        .dark .slash-command-badge {
          background-color: hsl(var(--primary) / 0.2);
          border-color: hsl(var(--primary) / 0.4);
        }
        
        .dark .slash-command-badge:hover {
          background-color: hsl(var(--primary) / 0.3);
          border-color: hsl(var(--primary) / 0.6);
        }
      `}</style>
    </div>
  );
}
