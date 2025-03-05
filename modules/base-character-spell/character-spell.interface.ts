import { BttKeyCode } from '../btt-client';

export type SpellKeyCodes =
    | BttKeyCode.Number0
    | BttKeyCode.Number1
    | BttKeyCode.Number2
    | BttKeyCode.Number3
    | BttKeyCode.Number4
    | BttKeyCode.Number5
    | BttKeyCode.Number6
    | BttKeyCode.Number7
    | BttKeyCode.Number8
    | BttKeyCode.Number9;

export type TargetChangeKeyCodes =
    | BttKeyCode.ArrowUp
    | BttKeyCode.ArrowDown
    | BttKeyCode.ArrowLeft
    | BttKeyCode.ArrowRight
    | BttKeyCode.Home;


export type SpellCastOptions = {
    isTargetChange: boolean;
    targetChangeKeyCode?: TargetChangeKeyCodes;
}