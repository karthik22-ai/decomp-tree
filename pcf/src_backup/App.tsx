import { useState } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import { ProjectSelector } from './components/ProjectSelector';
import './index.css';

function App() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isSampleMode, setIsSampleMode] = useState<boolean>(false);

  const handleSelectProject = (projectId: string, isSample: boolean = false) => {
    setCurrentProjectId(projectId);
    setIsSampleMode(isSample);
  };

  const handleBackToProjects = () => {
    setCurrentProjectId(null);
    setIsSampleMode(false);
  };

  return (
    <div className="app-container">
      {currentProjectId ? (
        <SimulationCanvas
          projectId={currentProjectId}
          isSampleMode={isSampleMode}
          onBack={handleBackToProjects}
        />
      ) : (
        <ProjectSelector onSelectProject={handleSelectProject} />
      )}
    </div>
  );
}

export default App;
