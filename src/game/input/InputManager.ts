export interface DriveInput {
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
}

export class InputManager implements DriveInput {
  steer = 0;
  throttle = 0;
  brake = 0;
  handbrake = false;

  private keys = new Set<string>();
  private virtual: Partial<DriveInput> = {};

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.virtual = {};
  };

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  setVirtual(partial: Partial<DriveInput>): void {
    this.virtual = partial;
  }

  private analog(pos: string[], neg: string[]): number {
    const p = pos.some((k) => this.keys.has(k)) ? 1 : 0;
    const n = neg.some((k) => this.keys.has(k)) ? 1 : 0;
    return p - n;
  }

  sample(): void {
    const kp = {
      steer: this.analog(['ArrowRight', 'KeyD'], ['ArrowLeft', 'KeyA']),
      throttle: this.analog(['ArrowUp', 'KeyW'], []),
      brake: this.analog(['ArrowDown', 'KeyS'], []),
      handbrake: this.keys.has('Space')
    };

    const v = this.virtual;
    const vSteer = v.steer ?? 0;
    this.steer = clamp(Math.abs(vSteer) > 0.001 ? vSteer : kp.steer, -1, 1);

    this.throttle = Math.max(kp.throttle, v.throttle ?? 0);
    this.brake = Math.max(kp.brake, v.brake ?? 0);
    this.handbrake = kp.handbrake || (v.handbrake ?? false);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
