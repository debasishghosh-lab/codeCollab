import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const socket = io("https://codecollab-puu6.onrender.com");

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Write here");
  const [copySuccess, setCopySuccess] = useState("");
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [joinPopup, setJoinPopup] = useState("");
  const [activeTab, setActiveTab] = useState("code"); // code / files
  const [files, setFiles] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768); // open on PC
  const editorRef = useRef(null);

  // Socket listeners
  useEffect(() => {
    socket.on("userJoined", (users) => setUsers(users));
    socket.on("userJoinedPopup", (name) => {
      setJoinPopup(`${name} joined the room`);
      setTimeout(() => setJoinPopup(""), 3000);
    });
    socket.on("codeUpdate", (newCode) => setCode(newCode));
    socket.on("languageUpdate", (newLang) => setLanguage(newLang));
    socket.on("userTyping", ({ userName, cursor }) => {
      setTypingUsers((prev) => ({ ...prev, [userName]: cursor }));
      setTimeout(() => {
        setTypingUsers((prev) => {
          const copy = { ...prev };
          delete copy[userName];
          return copy;
        });
      }, 2000);
    });
    socket.on("fileReceived", (file) => {
      setFiles((prev) => [...prev, file]);
    });
    return () => {
      socket.off("userJoined");
      socket.off("userJoinedPopup");
      socket.off("codeUpdate");
      socket.off("languageUpdate");
      socket.off("userTyping");
      socket.off("fileReceived");
    };
  }, []);

  // Disconnect on unload
  useEffect(() => {
    const handleBeforeUnload = () =>
      socket.emit("leaveRoom", { roomId, userName });
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [roomId, userName]);

  const joinRoom = () => {
    if (roomId && userName) {
      socket.emit("join", { roomId, userName });
      setJoined(true);
    }
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom", { roomId, userName });
    setJoined(false);
    setRoomId("");
    setUserName("");
    setCode("// Write here");
    setLanguage("javascript");
    setFiles([]);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit("codeChange", { roomId, code: newCode });
    if (editorRef.current) {
      const cursor = editorRef.current.getPosition();
      socket.emit("typing", { roomId, userName, cursor });
    }
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    socket.emit("languageChange", { roomId, language: newLanguage });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        buffer: arrayBuffer,
      };
      socket.emit("fileShare", { roomId, file: fileData });
      setFiles((prev) => [...prev, fileData]);
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadFile = (file) => {
    const blob = new Blob([file.buffer]);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    link.click();
  };

  if (!joined) {
    return (
      <>
        <div className="topbar-brand">
          <h4>codeCollab</h4>
        </div>
        <div className="join-container">
          <div className="join-form animate-fadein">
            <h1>👨‍💻 Join codeCollab Room</h1>
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <input
              type="text"
              placeholder="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
            <button onClick={joinRoom}>Join Room 🚀</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    
    <div className="editor-container">
      {joinPopup && <div className="popup animate-popup">{joinPopup}</div>}

      {/* Mobile Menu Button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        ☰
      </button>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-brand">
          <h4>codeCollab</h4>
        </div>

        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? "☰" : "☰"}
        </button>

        {/* --- your existing sidebar content stays same --- */}
        {sidebarOpen && (
          <>
            {/* Room Info */}
            <div className="room-info">
              <h2>🧩 Room: {roomId}</h2>
              <button onClick={copyRoomId} className="copy-button">
                📋 Copy ID
              </button>
              {copySuccess && (
                <span className="copy-success">{copySuccess}</span>
              )}
            </div>

            {/* Tabs */}
            <div className="tab-toggle">
              <button
                onClick={() => setActiveTab("code")}
                className={activeTab === "code" ? "active-tab" : ""}
              >
                🖋 Text
              </button>
              <button
                onClick={() => setActiveTab("files")}
                className={activeTab === "files" ? "active-tab" : ""}
              >
                📁 Files
              </button>
            </div>

            {/* Code Tab */}
            {activeTab === "code" && (
              <>
                <div className="user-list">
                  <h3>👥 Connected Users</h3>
                  <ul>
                    {users.map((user, idx) => (
                      <li key={idx}>{user.slice(0, 8)}...</li>
                    ))}
                  </ul>
                </div>

                {Object.keys(typingUsers).length > 0 && (
                  <p className="typing-indicator">
                    {Object.keys(typingUsers)
                      .map((u) => `${u.slice(0, 8)}... is typing ✍️`)
                      .join(", ")}
                  </p>
                )}
              </>
            )}

            {/* Files Tab */}
            {activeTab === "files" && (
              <>
                <h3>📁 Upload File</h3>
                <input type="file" onChange={handleFileUpload} />
              </>
            )}

            <button className="leave-button" onClick={leaveRoom}>
              ❌ Leave Room
            </button>
          </>
        )}
      </div>
      {/* <div className="topbar-brand">
        <h4>codeCollab</h4>
      </div> */}
      {/* Main Content */}

      <div className="main-area">
        {activeTab === "code" && (
          <div className="editor-wrapper animate-fadein">
            <Editor
              height="100%"
              defaultLanguage={language}
              language={language}
              value={code}
              onChange={handleCodeChange}
              theme="vs-dark"
              onMount={(editor) => (editorRef.current = editor)}
              options={{
                minimap: { enabled: false },
                fontSize: 15,
                smoothScrolling: true,
              }}
            />
          </div>
        )}

        {activeTab === "files" && (
          <div className="file-panel animate-fadein">
            {files.length > 0 ? (
              files.map((file, idx) => (
                <button
                  key={idx}
                  className="file-share-btn"
                  onClick={() => downloadFile(file)}
                >
                  {file.name}
                </button>
              ))
            ) : (
              <p>No files shared yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default App;
