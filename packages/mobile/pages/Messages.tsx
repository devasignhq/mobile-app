import React, { useState, useRef, useEffect } from 'react';
import { Search, ArrowLeft, Paperclip, Send, FileText, CheckCheck, Lock, Link as LinkIcon, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  type: 'text' | 'code' | 'file' | 'image';
  fileSize?: string;
  mediaUrl?: string; // For local image uploads or rich media
}

// Mock Data for Contacts
const CONTACTS = [
  {
    id: 'c1',
    name: 'acdlite',
    avatar: 'https://picsum.photos/seed/fb/100',
    repo: 'facebook/react',
    status: 'Active',
    lastMessage: 'Check the docs: https://react.dev',
    time: '2m',
    unread: 2,
    online: true
  },
  {
    id: 'c2',
    name: 'toly',
    avatar: 'https://picsum.photos/seed/sol/100',
    repo: 'solana-labs/solana',
    status: 'Review',
    lastMessage: 'Performance metrics look good. Merging soon.',
    time: '1h',
    unread: 0,
    online: false
  },
  {
    id: 'c3',
    name: 'scopsy',
    avatar: 'https://picsum.photos/seed/novu/100',
    repo: 'novuhq/novu',
    status: 'Completed',
    lastMessage: 'Payment has been processed.',
    time: '1d',
    unread: 0,
    online: false
  }
];

// Mock Messages for a conversation
const INITIAL_MESSAGES: Message[] = [
  {
    id: 'm1',
    senderId: 'other',
    text: 'Hey! Thanks for picking up the concurrent rendering issue.',
    time: '10:00 AM',
    type: 'text'
  },
  {
    id: 'm2',
    senderId: 'me',
    text: 'No problem. I suspect it\'s related to the priority queue in the scheduler.',
    time: '10:05 AM',
    type: 'text'
  },
  {
    id: 'm3',
    senderId: 'other',
    text: 'Exactly what we thought. Here is the reproduction case:',
    time: '10:07 AM',
    type: 'text'
  },
  {
    id: 'm4',
    senderId: 'other',
    text: 'const list = new Array(10000).fill(0);',
    time: '10:07 AM',
    type: 'code'
  },
  {
    id: 'm5',
    senderId: 'me',
    text: 'I found the bug. Here is a screenshot of the profiler:',
    time: '10:15 AM',
    type: 'text'
  },
  {
    id: 'm6',
    senderId: 'me',
    text: 'https://picsum.photos/seed/bug/400/200',
    time: '10:16 AM',
    type: 'text' // We'll detect it's an image link
  },
  {
    id: 'm7',
    senderId: 'other',
    text: 'Nice catch! Please refer to the new documentation for the fix: https://react.dev/reference/react/useTransition',
    time: '10:20 AM',
    type: 'text'
  }
];

const isImageUrl = (url: string) => {
  return url.match(/\.(jpeg|jpg|gif|png)$/) != null || url.includes('picsum.photos');
};

const LinkPreview: React.FC<{ url: string }> = ({ url }) => {
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch (e) {
    domain = url;
  }

  // Mock metadata based on domain
  let title = 'Link Preview';
  let desc = 'Tap to view this link in your browser.';
  let image = '';

  if (domain.includes('react.dev')) {
    title = 'useTransition – React';
    desc = 'useTransition is a React Hook that lets you update the state without blocking the UI.';
    image = 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg';
  } else if (domain.includes('github.com')) {
    title = 'GitHub Repository';
    desc = 'Where the world builds software. Millions of developers and companies build, ship, and maintain their software on GitHub.';
    image = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 mb-1 bg-black/40 border border-white/10 rounded-xl overflow-hidden hover:bg-black/60 transition-colors group text-left max-w-sm"
    >
      {image && (
        <div className="h-32 w-full overflow-hidden bg-white/5 relative">
          <img src={image} alt="" className={`w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity ${domain.includes('react') || domain.includes('github') ? 'p-8 object-contain' : ''}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
        </div>
      )}
      <div className="p-3">
        <h4 className="font-bold text-sm text-white truncate">{title}</h4>
        <p className="text-xs text-text-secondary line-clamp-2 mt-1 leading-relaxed">{desc}</p>
        <div className="flex items-center gap-1.5 text-[10px] text-primary/80 mt-2 font-medium">
          <LinkIcon size={10} /> {domain}
        </div>
      </div>
    </a>
  );
};

export const Messages: React.FC = () => {
  const { contactId } = useParams();
  const navigate = useNavigate();

  const selectedContact = CONTACTS.find(c => c.id === contactId);

  return (
    <div className="h-full bg-background flex flex-col relative overflow-hidden">
      {!selectedContact ? (
        <ContactList onSelect={(id) => navigate(`/messages/${id}`)} />
      ) : (
        <ChatInterface
          contact={selectedContact}
          onBack={() => navigate('/messages')}
        />
      )}
    </div>
  );
};

const ContactList: React.FC<{ onSelect: (id: string) => void }> = ({ onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const filteredContacts = CONTACTS.filter(contact => {
    const term = searchTerm.toLowerCase();
    return (
      contact.name.toLowerCase().includes(term) ||
      contact.repo.toLowerCase().includes(term) ||
      contact.lastMessage.toLowerCase().includes(term)
    );
  });

  return (
    <div className="h-full overflow-y-auto hide-scrollbar animate-in fade-in duration-300">
      {/* Header with Search Toggle */}
      <div className="px-5 pt-7 pb-2 shrink-0 min-h-[60px] flex items-center">
        {isSearchOpen ? (
          <div className="flex-1 flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
              <input
                autoFocus
                type="text"
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 placeholder:text-text-secondary/60 transition-colors"
              />
            </div>
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchTerm('');
              }}
              className="p-2 bg-surface hover:bg-white/10 rounded-full text-text-secondary hover:text-white transition-colors border border-white/5"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center w-full animate-in fade-in slide-in-from-left-2 duration-200">
            <h2 className="text-xl font-bold text-white">Chat</h2>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2.5 -mr-2 text-white hover:bg-surface rounded-full transition-all active:scale-95"
            >
              <Search size={22} />
            </button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="px-3 pb-24 space-y-1 mt-2">
        {filteredContacts.length > 0 ? (
          filteredContacts.map(contact => (
            <div
              key={contact.id}
              onClick={() => onSelect(contact.id)}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface/50 active:bg-surface transition-colors cursor-pointer group"
            >
              <div className="relative shrink-0">
                <img src={contact.avatar} alt={contact.name} className="w-12 h-12 rounded-full object-cover border border-white/5" />
                {contact.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-background"></div>
                )}
              </div>

              <div className="flex-1 min-w-0 border-b border-white/5 pb-3 group-last:border-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-white text-base">{contact.name}</h3>
                  <span className={`text-xs ${contact.unread > 0 ? 'text-primary font-bold' : 'text-text-secondary'}`}>
                    {contact.time}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    {contact.unread > 0 ? (
                      <p className="text-white font-medium text-sm truncate">{contact.lastMessage}</p>
                    ) : (
                      <p className="text-text-secondary text-sm truncate">{contact.lastMessage}</p>
                    )}
                  </div>
                  {contact.unread > 0 && (
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-background">{contact.unread}</span>
                    </div>
                  )}
                </div>

                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${contact.status === 'Active' ? 'border-warning/30 text-warning bg-warning/10' :
                    contact.status === 'Review' ? 'border-white/20 text-text-secondary bg-white/5' :
                      'border-success/30 text-success bg-success/10'
                    }`}>
                    {contact.status}
                  </span>
                  <span className="text-[10px] text-text-secondary font-mono opacity-70">
                    {contact.repo}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-text-secondary">
            {searchTerm ? <p>No chats match "{searchTerm}"</p> : <p>No conversations found</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatInterface: React.FC<{ contact: typeof CONTACTS[0], onBack: () => void }> = ({ contact, onBack }) => {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    // Detect if code block (simple heuristic)
    const isCode = inputText.includes('const ') || inputText.includes('function') || inputText.includes('```');
    const cleanText = inputText.replace(/```/g, '');

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      text: cleanText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: isCode ? 'code' : 'text',
      fileSize: undefined
    };

    setMessages([...messages, newMessage]);
    setInputText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const newMessage: Message = {
            id: Date.now().toString(),
            senderId: 'me',
            text: file.name,
            mediaUrl: ev.target?.result as string,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'image',
            fileSize: (file.size / 1024).toFixed(1) + ' KB'
          };
          setMessages([...messages, newMessage]);
        };
        reader.readAsDataURL(file);
      } else {
        const newMessage: Message = {
          id: Date.now().toString(),
          senderId: 'me',
          text: file.name,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'file',
          fileSize: (file.size / 1024).toFixed(1) + ' KB'
        };
        setMessages([...messages, newMessage]);
      }
    }
  };

  const isReadOnly = contact.status === 'Completed';

  // Helper to render text with links and previews
  const renderMessageContent = (msg: Message) => {
    if (msg.type === 'code') {
      return (
        <pre className="font-mono text-xs bg-black/30 p-3 rounded-lg overflow-x-auto border border-black/10 my-1 hide-scrollbar">
          <code>{msg.text}</code>
        </pre>
      );
    }

    if (msg.type === 'file') {
      return (
        <div className="flex items-center gap-3 bg-black/20 p-2.5 rounded-lg border border-black/5 pr-4">
          <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center text-current">
            <FileText size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm line-clamp-1 break-all">{msg.text}</span>
            <span className="text-[10px] opacity-70">{msg.fileSize || '24 KB'} • Document</span>
          </div>
        </div>
      );
    }

    if (msg.type === 'image') {
      return (
        <div className="space-y-1">
          <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20">
            <img src={msg.mediaUrl || msg.text} alt="Attachment" className="max-w-full h-auto max-h-64 object-cover w-full" />
          </div>
          {msg.text && !isImageUrl(msg.text) && <p className="text-sm px-1">{msg.text}</p>}
        </div>
      );
    }

    // Default 'text' handling with URL parsing
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = msg.text.split(urlRegex);
    const urls = msg.text.match(urlRegex) || [];

    return (
      <div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {parts.map((part, i) => {
            if (part.match(urlRegex)) {
              return (
                <a
                  key={i}
                  href={part}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {part}
                </a>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </p>

        {/* Render Previews */}
        <div className="flex flex-col gap-2 mt-2">
          {urls.map((url, i) => {
            if (isImageUrl(url)) {
              return (
                <div key={i} className="rounded-xl overflow-hidden border border-white/10 mt-1 max-w-sm">
                  <img src={url} alt="Preview" className="w-full h-auto object-cover max-h-60" />
                </div>
              );
            }
            return <LinkPreview key={i} url={url} />;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col h-[100dvh] bg-[#0a0a0a] animate-in slide-in-from-right duration-300">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface/50 backdrop-blur-md border-b border-white/5 shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-white" />
        </button>

        <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-full border border-white/10" />

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-base leading-none">{contact.name}</h3>
          <span className="text-xs text-text-secondary truncate block mt-1">{contact.repo} • {contact.status}</span>
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-6 hide-scrollbar"
        style={{ backgroundImage: 'radial-gradient(circle at center, #1a1a1a 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        <div className="text-center py-4">
          <span className="bg-surface/80 text-text-secondary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-white/5 shadow-sm">
            Today
          </span>
        </div>

        {messages.map((msg) => {
          const isMe = msg.senderId === 'me';
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
              <div
                className={`
                  max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 shadow-sm relative
                  ${isMe
                    ? 'bg-surface text-white border border-primary/20 rounded-tr-sm'
                    : 'bg-surface border border-white/10 text-gray-200 rounded-tl-sm'
                  }
                `}
              >
                {renderMessageContent(msg)}

                {/* Metadata */}
                <div className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${isMe ? 'text-gray-400' : 'text-gray-500'}`}>
                  {msg.time}
                  {isMe && <CheckCheck size={12} className="opacity-80" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {isReadOnly ? (
        <div className="p-6 bg-background border-t border-white/5 flex flex-col items-center justify-center text-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary mb-1">
            <Lock size={20} />
          </div>
          <div>
            <p className="text-white font-medium text-sm">Task Completed</p>
            <p className="text-text-secondary text-xs mt-0.5">This conversation is now read-only.</p>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-background border-t border-white/5">
          <div className="flex items-end gap-2 bg-surface p-2 rounded-2xl border border-white/10 focus-within:border-primary/50 transition-colors shadow-lg">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-text-secondary hover:text-white hover:bg-white/5 rounded-full transition-colors shrink-0"
            >
              <Paperclip size={20} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileUpload}
            />

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-white placeholder:text-text-secondary/50 text-sm py-3 px-1 max-h-32 focus:outline-none resize-none hide-scrollbar font-sans"
              rows={1}
              style={{ minHeight: '44px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className={`
                  p-2.5 rounded-full shrink-0 transition-all duration-300
                  ${inputText.trim()
                  ? 'bg-primary text-background shadow-[0_0_15px_-3px_rgba(254,137,31,0.5)] rotate-0 scale-100'
                  : 'bg-white/5 text-text-secondary/50 rotate-0 scale-90 cursor-not-allowed'
                }
                `}
            >
              <Send size={18} fill={inputText.trim() ? "currentColor" : "none"} className={inputText.trim() ? "translate-x-0.5" : ""} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};