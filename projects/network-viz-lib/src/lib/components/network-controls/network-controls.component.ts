import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'nvl-network-controls',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="network-controls" *ngIf="visible">
      <button type="button"
              class="control-button"
              [disabled]="disabled"
              (click)="zoomIn.emit()"
              aria-label="Zoom in"
              title="Zoom in (+)">
        <span class="control-icon">+</span>
      </button>

      <button type="button"
              class="control-button"
              [disabled]="disabled"
              (click)="zoomOut.emit()"
              aria-label="Zoom out"
              title="Zoom out (-)">
        <span class="control-icon">−</span>
      </button>

      <button type="button"
              class="control-button"
              [disabled]="disabled"
              (click)="fitToView.emit()"
              aria-label="Fit to view"
              title="Fit to view (0)">
        <span class="control-icon">⌂</span>
      </button>

      <button type="button"
              class="control-button"
              [disabled]="disabled"
              (click)="toggleForces.emit()"
              aria-label="Toggle forces"
              title="Toggle physics simulation (Space)">
        <span class="control-icon">{{ forcesEnabled ? '⏸' : '▶' }}</span>
      </button>

      <button type="button"
              class="control-button"
              [disabled]="disabled"
              (click)="resetView.emit()"
              aria-label="Reset view"
              title="Reset view (R)">
        <span class="control-icon">↺</span>
      </button>
    </div>
  `,
  styles: [`
    .network-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 200;
    }

    .control-button {
      width: 36px;
      height: 36px;
      border: 1px solid #ccc;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: all 0.2s ease-in-out;
    }

    .control-button:hover:not(:disabled) {
      background: #f8f9fa;
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      transform: translateY(-1px);
    }

    .control-button:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .control-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .control-icon {
      font-weight: bold;
      line-height: 1;
    }

    @media (max-width: 768px) {
      .network-controls {
        bottom: 10px;
        top: auto;
        right: 10px;
        flex-direction: row;
        flex-wrap: wrap;
        max-width: calc(100% - 20px);
      }

      .control-button {
        width: 32px;
        height: 32px;
        font-size: 14px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NetworkControlsComponent {
  @Input() visible: boolean = true;
  @Input() disabled: boolean = false;
  @Input() forcesEnabled: boolean = true;

  @Output() zoomIn = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();
  @Output() fitToView = new EventEmitter<void>();
  @Output() resetView = new EventEmitter<void>();
  @Output() toggleForces = new EventEmitter<void>();
}
