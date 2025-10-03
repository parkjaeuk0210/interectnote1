import React from 'react';
import { Layer } from 'react-konva';
import { EnterpriseNote } from '../Note/EnterpriseNote';
import { CanvasImage } from './CanvasImage';
import { CanvasFile } from './CanvasFile';
import { Note, CanvasImage as ICanvasImage, CanvasFile as ICanvasFile } from '../../types';

interface CanvasItemsProps {
  notes: Note[];
  images: ICanvasImage[];
  files: ICanvasFile[];
  editingNoteId: string | null;
  selectedImageId: string | null;
  selectedFileId: string | null;
  selectImage: (id: string | null) => void;
  selectFile: (id: string | null) => void;
  setEditingNoteId: (id: string | null) => void;
  setIsAnyNoteResizing: (isResizing: boolean) => void;
  setIsAnyNoteDragging: (isDragging: boolean) => void;
}

export const CanvasItems: React.FC<CanvasItemsProps> = ({
  notes,
  images,
  files,
  editingNoteId,
  selectedImageId,
  selectedFileId,
  selectImage,
  selectFile,
  setEditingNoteId,
  setIsAnyNoteResizing,
  setIsAnyNoteDragging,
}) => {
  return (
    <Layer>
      {/* Render images */}
      {images.map((image) => (
        <CanvasImage
          key={image.id}
          image={image}
          isSelected={selectedImageId === image.id}
          onSelect={() => selectImage(image.id)}
          onResizingChange={(isResizing) => {
            setIsAnyNoteResizing(isResizing);
          }}
          onDraggingChange={(isDragging) => {
            setIsAnyNoteDragging(isDragging);
          }}
        />
      ))}
      
      {/* Render files */}
      {files.map((file) => (
        <CanvasFile
          key={file.id}
          file={file}
          isSelected={selectedFileId === file.id}
          onSelect={() => selectFile(file.id)}
          onDraggingChange={(isDragging) => {
            setIsAnyNoteDragging(isDragging);
          }}
        />
      ))}
      
      {/* Render notes sorted by zIndex */}
      {[...notes]
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
        .map((note) => (
          <EnterpriseNote 
            key={note.id} 
            note={note} 
            isEditing={editingNoteId === note.id}
            onStartEditing={() => setEditingNoteId(note.id)}
            onResizingChange={(isResizing) => {
              setIsAnyNoteResizing(isResizing);
            }}
            onDraggingChange={(isDragging) => {
              setIsAnyNoteDragging(isDragging);
            }}
          />
        ))}
    </Layer>
  );
};