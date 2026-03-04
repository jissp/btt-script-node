import { inject, injectable } from 'tsyringe';
import { BaseScript, GameContext, GameRect, ocrByClipboard, screenCapture, ScriptContext } from '../common';
import { BttKeyCode, ImageSearchAfterMouseMoveType, ImageSearchOn, ImageSearchRegion } from '../modules/btt-client';
import { sleep } from '../common/utils';

enum Sequence {
    // 왕궁 캐릭터에게 출두
    Teleport,
    // 왕 퀘스트 받기
    GetKingQuest,
    // 흉가로 이동
    GoToHauntedHouse,
    // 몬스터 사냥
    KillMonster,
    // 왕궁에서 왕 앞까지 이동
    GoToKing,
}

enum FirstDialogType {
    NotFound = 0,
    RequestQuest = 1,
    RejectQuest = 2,
}

@injectable()
export class AutoKingQuest extends BaseScript {
    private stage: Sequence = Sequence.GetKingQuest;

    constructor(@inject(ScriptContext) scriptContext: ScriptContext, @inject(GameContext) gameContext: GameContext) {
        super(scriptContext, gameContext);
    }

    public async initialized(): Promise<void> {
        await this.analysisKingQuestStage();
    }

    public async analysisKingQuestStage() {
        this.stage = Sequence.GoToHauntedHouse;

        // 1. 현재 받은 왕 퀘스트 확인하기
        // 2. 만약 왕 퀘스트(허용된 몹)를 받은 상태라면 헌티드 하우스로 이동 -> stage = GoToHauntedHouse
        // 3. 만약 왕 퀘스트를 받지 않은 상태라면
        // 4. 현재 지역을 체크해서 왕궁이 아니라면 왕궁으로 이동 -> stage = Teleport
        // 5. 왕궁이라면
        // 6. 왕을 찾을 수 있다면 -> stage = getKingQuest
        // 7. 왕을 찾을 수 없다면 -> stage = GoToKing
    }

    public async handle(): Promise<void> {
        switch (this.stage) {
            case Sequence.GetKingQuest:
                await this.getKingQuest();
                break;
            case Sequence.Teleport:
                await this.getKingQuest();
                break;
            case Sequence.GoToHauntedHouse:
                await this.goToHauntedHouse();
                break;
        }
    }

    async getKingQuest() {
        try {
            await this.scriptContext.bttService.mouseMoveToXY(0, 0);
            await sleep(100);

            const isSearchKing = await this.searchKing();
            if (!isSearchKing) {
                return;
            }

            // 퀘스트 받기 시도
            await sleep(100);
            await this.scriptContext.bttService.mouseLeftClick();
            await sleep(100);

            // 창이 떴는지 확인
            const openedKingDialogType = await this.waitCallback<null | FirstDialogType>(this.getOpenedKingDialogType);
            if (openedKingDialogType === null) {
                return;
            }

            if (openedKingDialogType === FirstDialogType.RequestQuest) {
                await this.processRequestQuest();
            } else {
                await this.processRejectQuest();
            }

            // 창 끄고 일정 시간 후 재시도
            await sleep(250);
        } catch (error) {
        } finally {
            await this.scriptContext.bttService.sendKey(BttKeyCode.ESC, 2000);
        }
    }

    async goToHauntedHouse() {
        await screenCapture({
            rect: this.scriptContext.scriptHelper.getActiveWindowRect(),
        });
        const mapName = await ocrByClipboard(GameRect.MapName);

        console.log(mapName);
        // await this.move(74, 143);
    }

    async processRequestQuest() {
        // 퀘스트 수락 직전까지 진행
        const isQuestConfirmDialog = await this.waitQuestConfirmDialog();
        if (!isQuestConfirmDialog) {
            console.log('퀘스트 수락 실패');
        }

        // 퀘스트 수락하기 (렉으로 인해 진행이 안될 수 있으니 일정 횟수 반복)
        for (let i = 0; i < 5; i++) {
            await this.scriptContext.bttService.sendKeys({
                keyCodes: [BttKeyCode.ArrowUp, BttKeyCode.ArrowUp, BttKeyCode.Enter],
                options: {
                    keyInternal: 150,
                },
            });
            await sleep(100);

            if (!(await this.isSearchedTextFromGameRect('받겠습니다'))) {
                break;
            }
        }

        const questMonsterName = await this.waitAndExtractQuestMonsterName();
        await this.scriptContext.bttService.sendKey(BttKeyCode.ESC, 250);

        // 퀘스트 대상 몬스터를 추출했다면...
        if (questMonsterName && ['처녀귀신'].includes(questMonsterName)) {
            await this.useRecallItem();

            this.stage = Sequence.GoToHauntedHouse;
        }
    }

    async processRejectQuest() {
        if (!(await this.waitRejectQuestConfirmDialog())) {
            throw new Error('퀘스트 거부 실패');
        }

        for (let i = 0; i < 5; i++) {
            await this.scriptContext.bttService.sendKeys({
                keyCodes: [BttKeyCode.ArrowUp, BttKeyCode.ArrowUp, BttKeyCode.Enter],
                options: {
                    keyInternal: 150,
                },
            });
            await sleep(100);

            if (!(await this.isSearchedTextFromGameRect('임무를 취소시켜주십시오'))) {
                break;
            }
        }

        if (
            !(await this.waitCallback<boolean>(async () => {
                return this.isSearchedTextFromGameRect('형벌을');
            }))
        ) {
            throw new Error('퀘스트 거부 실패');
        }

        await this.scriptContext.bttService.sendKey(BttKeyCode.Enter, 100);

        return;
    }

    async teleport() {
        await this.scriptContext.bttService.sendKey(BttKeyCode.Number0);
        // 출두 캐릭

        const gameLog = await this.gameContext.system.getLastGameLog();
        if (gameLog.includes('바람의나라에 없습니다.')) {
            // 오 마이 갓.....
        }

        // 왕궁으로 이동
    }

    async useRecallItem() {
        await this.scriptContext.bttService.sendKeys({
            keyCodes: [BttKeyCode.u, BttKeyCode.e],
        });
    }

    private async waitCallback<T>(callback: () => Promise<T>, tryCount: number = 10): Promise<T | null> {
        for (let i = 0; i < tryCount; i++) {
            await this.scriptContext.scriptHelper.terminateIfNotRunning();

            const result = await callback.call(this);
            if (result) {
                return result;
            }

            await sleep(50);
        }

        return null;
    }

    private async getOpenedKingDialogType(): Promise<FirstDialogType | null> {
        const gameBoxText = await this.extractGameBoxText();

        if (await this.isSearchedTextFromGameRect('나를 통해서 하시오', gameBoxText)) {
            return FirstDialogType.RequestQuest;
        } else if (await this.isSearchedTextFromGameRect('네 이놈', gameBoxText)) {
            return FirstDialogType.RejectQuest;
        }

        return null;
    }

    private async waitQuestConfirmDialog(tryCount: number = 10) {
        for (let i = 0; i < tryCount; i++) {
            await this.scriptContext.scriptHelper.terminateIfNotRunning();

            if (await this.isSearchedTextFromGameRect('받겠습니다')) {
                return true;
            }

            await this.scriptContext.bttService.sendKey(BttKeyCode.Enter);
            await sleep(100);
        }

        return false;
    }

    private async waitRejectQuestConfirmDialog(tryCount: number = 10) {
        for (let i = 0; i < tryCount; i++) {
            await this.scriptContext.scriptHelper.terminateIfNotRunning();

            if (await this.isSearchedTextFromGameRect('임무를 취소시켜주십시오')) {
                return true;
            }

            await this.scriptContext.bttService.sendKey(BttKeyCode.Enter);
            await sleep(100);
        }

        return false;
    }

    private async isSearchedTextFromGameRect(text: string | string[], gameBoxText?: string) {
        if (!gameBoxText) {
            gameBoxText = await this.extractGameBoxText();
        }

        if (Array.isArray(text)) {
            return text.some(t => gameBoxText.includes(t));
        }

        return gameBoxText.includes(text);
    }

    private async extractGameBoxText() {
        await screenCapture({ rect: this.scriptContext.scriptHelper.getActiveWindowRect() });
        const gameBoxText = await ocrByClipboard(GameRect.GameBoxForKingQuest);

        return gameBoxText.trim();
    }

    private async waitAndExtractQuestMonsterName() {
        for (let i = 0; i < 10; i++) {
            await this.scriptContext.scriptHelper.terminateIfNotRunning();

            const gameBoxText = await this.extractGameBoxText();
            console.log(gameBoxText.trim());
            if (gameBoxText.includes('잡으라는')) {
                return this.extractQuestMonsterName(gameBoxText);
            }

            await sleep(100);
        }

        return false;
    }

    public extractQuestMonsterName(text: string): string {
        const matches = text.match(/[어명]?이오[!]?[ ]?([가-힣]+)[을를] /);
        if (!matches) {
            throw new Error('Not Extract Monster Name');
        }

        return matches[1] as string;
    }

    async searchKing() {
        return this.scriptContext.bttService.imageSearch({
            imageWithBase64:
                'iVBORw0KGgoAAAANSUhEUgAAAD8AAAAbCAYAAADLYlf_AAAMTGlDQ1BJQ0MgUHJvZmlsZQAASImVVwdYU1cbPndkQggQiICMsJcgIiOAjBBW2BtBVEISIIwYE4KKGylWsG4RwVHRKkNxVUCKC7VqpSjuXRyoKLVYi1v5Twigpf94_u95zr3vfc933vN93z13HADoXXypNBfVBCBPki+LDfZnTU5OYZF6AAoYAAGOgMkXyKWc6OhwAG34_Hd7fQ16QrvsoNT6Z_9_NS2hSC4AAImGOF0oF+RB_CMAeKtAKssHgCiFvPmsfKkSr4NYRwYDhLhGiTNVuFWJ01X44qBPfCwX4kcAkNX5fFkmABp9kGcVCDKhDh1mC5wkQrEEYj+IffLyZgghXgSxDfSBc9KV+uz0r3Qy_6aZPqLJ52eOYFUug0YOEMulufw5_2c5_rfl5SqG57CGTT1LFhKrzBnW7VHOjDAlVof4rSQ9MgpibQBQXCwc9FdiZpYiJEHlj9oI5FxYM8CEeJI8N443xMcK+QFhEBtCnCHJjQwf8inKEAcpfWD90ApxPi8eYj2Ia0TywLghn+OyGbHD817LkHE5Q_xTvmwwBqX+Z0VOAkelj2lniXhD+phjYVZ8EsRUiAMKxImREGtAHCnPiQsb8kktzOJGDvvIFLHKXCwglokkwf4qfaw8QxYUO+Rflycfzh07niXmRQ7hS_lZ8SGqWmGPBPzB+GEuWJ9IwkkY1hHJJ4cP5yIUBQSqcsfJIklCnIrH9aT5_rGqsbidNDd6yB_3F+UGK3kziOPlBXHDYwvy4eJU6eMl0vzoeFWceGU2PzRaFQ++D4QDLggALKCALR3MANlA3NHb1AuvVD1BgA9kIBOIgMMQMzwiabBHAo9xoBD8DpEIyEfG+Q_2ikAB5D+NYpWceIRTHR1AxlCfUiUHPIY4D4SBXHitGFSSjESQCB5BRvyPiPiwCWAOubAp+_89P8x+YTiQCR9iFMMzsujDnsRAYgAxhBhEtMUNcB_cCw+HRz_YnHE27jGcxxd_wmNCJ+EB4Sqhi3BzurhINirKCNAF9YOG6pP+dX1wK6jpivvj3lAdKuNM3AA44C5wHg7uC2d2hSx3KG5lVVijtP+WwVd3aMiP4kRBKWMofhSb0SM17DRcR1SUtf66PqpY00fqzR3pGT0_96vqC+E5bLQn9i12EDuDncDOYa1YE2Bhx7BmrB07osQjK+7R4Iobni12MJ4cqDN6zXy5s8pKyp3qnXqcPqr68kWz85UPI3eGdI5MnJmVz+LAL4aIxZMIHMexnJ2cXQFQfn9Ur7dXMYPfFYTZ_oVb8hsA3scGBgZ++sKFHgNgvzt8JRz+wtmw4adFDYCzhwUKWYGKw5UHAnxz0OHTpw+MgTmwgfk4AzfgBfxAIAgFUSAeJINpMPosuM5lYBaYBxaDElAGVoH1oBJsBdtBDdgDDoAm0ApOgJ_BeXARXAW34erpBs9BH3gNPiAIQkJoCAPRR0wQS8QecUbYiA8SiIQjsUgykoZkIhJEgcxDliBlyBqkEtmG1CL7kcPICeQc0oncRO4jPcifyHsUQ9VRHdQItULHo2yUg4ah8ehUNBOdiRaixegKtAKtRnejjegJ9Dx6Fe1Cn6P9GMDUMCZmijlgbIyLRWEpWAYmwxZgpVg5Vo01YC3wPl_GurBe7B1OxBk4C3eAKzgET8AF+Ex8Ab4cr8Rr8Eb8FH4Zv4_34Z8JNIIhwZ7gSeARJhMyCbMIJYRywk7CIcJp+Cx1E14TiUQm0ZroDp_FZGI2cS5xOXEzcS_xOLGT+JDYTyKR9En2JG9SFIlPyieVkDaSdpOOkS6RuklvyWpkE7IzOYicQpaQi8jl5DryUfIl8hPyB4omxZLiSYmiCClzKCspOygtlAuUbsoHqhbVmupNjadmUxdTK6gN1NPUO9RXampqZmoeajFqYrVFahVq+9TOqt1Xe6eurW6nzlVPVVeor1DfpX5c_ab6KxqNZkXzo6XQ8mkraLW0k7R7tLcaDA1HDZ6GUGOhRpVGo8YljRd0Ct2SzqFPoxfSy+kH6RfovZoUTStNriZfc4FmleZhzeua_VoMrQlaUVp5Wsu16rTOaT3VJmlbaQdqC7WLtbdrn9R+yMAY5gwuQ8BYwtjBOM3o1iHqWOvwdLJ1ynT26HTo9Olq67roJurO1q3SPaLbxcSYVkweM5e5knmAeY35fozRGM4Y0ZhlYxrGXBrzRm+snp+eSK9Ub6_eVb33+iz9QP0c_dX6Tfp3DXADO4MYg1kGWwxOG_SO1RnrNVYwtnTsgbG3DFFDO8NYw7mG2w3bDfuNjI2CjaRGG41OGvUaM439jLON1xkfNe4xYZj4mIhN1pkcM3nG0mVxWLmsCtYpVp+poWmIqcJ0m2mH6Qcza7MEsyKzvWZ3zanmbPMM83XmbeZ9FiYWERbzLOotbllSLNmWWZYbLM9YvrGytkqyWmrVZPXUWs+aZ11oXW99x4Zm42sz06ba5oot0ZZtm2O72faiHWrnapdlV2V3wR61d7MX22+27xxHGOcxTjKuetx1B3UHjkOBQ73DfUemY7hjkWOT44vxFuNTxq8ef2b8ZydXp1ynHU63J2hPCJ1QNKFlwp_Ods4C5yrnKxNpE4MmLpzYPPGli72LyGWLyw1XhmuE61LXNtdPbu5uMrcGtx53C_c0903u19k67Gj2cvZZD4KHv8dCj1aPd55unvmeBzz_8HLwyvGq83o6yXqSaNKOSQ+9zbz53tu8u3xYPmk+3_t0+Zr68n2rfR_4mfsJ_Xb6PeHYcrI5uzkv_J38Zf6H_N9wPbnzuccDsIDggNKAjkDtwITAysB7QWZBmUH1QX3BrsFzg4+HEELCQlaHXOcZ8QS8Wl5fqHvo_NBTYephcWGVYQ_C7cJl4S0RaERoxNqIO5GWkZLIpigQxYtaG3U32jp6ZvRPMcSY6JiqmMexE2LnxZ6JY8RNj6uLex3vH78y_naCTYIioS2RnpiaWJv4JikgaU1S1+Txk+dPPp9skCxObk4hpSSm7EzpnxI4Zf2U7lTX1JLUa1Otp86eem6awbTcaUem06fzpx9MI6QlpdWlfeRH8av5_em89E3pfQKuYIPgudBPuE7YI_IWrRE9yfDOWJPxNNM7c21mT5ZvVnlWr5grrhS_zA7J3pr9JicqZ1fOQG5S7t48cl5a3mGJtiRHcmqG8YzZMzql9tISaddMz5nrZ_bJwmQ75Yh8qrw5Xwf+6LcrbBTfKO4X+BRUFbydlTjr4Gyt2ZLZ7XPs5iyb86QwqPCHufhcwdy2eabzFs+7P58zf9sCZEH6graF5guLF3YvCl5Us5i6OGfxr0VORWuK_lqStKSl2Kh4UfHDb4K_qS_RKJGVXF_qtXTrt_i34m87lk1ctnHZ51Jh6S9lTmXlZR+XC5b_8t2E7yq+G1iRsaJjpdvKLauIqySrrq32XV2zRmtN4ZqHayPWNq5jrStd99f66evPlbuUb91A3aDY0FURXtG80WLjqo0fK7Mqr1b5V+3dZLhp2aY3m4WbL23x29Kw1Whr2db334u_v7EteFtjtVV1+Xbi9oLtj3ck7jjzA_uH2p0GO8t2ftol2dVVE1tzqta9trbOsG5lPVqvqO_Znbr74p6APc0NDg3b9jL3lu0D+xT7nu1P23_tQNiBtoPsgw0_Wv646RDjUGkj0jinsa8pq6mrObm583Do4bYWr5ZDPzn+tKvVtLXqiO6RlUepR4uPDhwrPNZ_XHq890TmiYdt09tun5x88sqpmFMdp8NOn_056OeTZzhnjp31Ptt6zvPc4V_YvzSddzvf2O7afuhX118Pdbh1NF5wv9B80eNiS+ekzqOXfC+duBxw+ecrvCvnr0Ze7byWcO3G9dTrXTeEN57ezL358lbBrQ+3F90h3Cm9q3m3_J7hverfbH_b2+XWdeR+wP32B3EPbj8UPHz+SP7oY3fxY9rj8icmT2qfOj9t7QnqufhsyrPu59LnH3pLftf6fdMLmxc__uH3R3vf5L7ul7KXA38uf6X_atdfLn+19Uf333ud9_rDm9K3+m9r3rHfnXmf9P7Jh1kfSR8rPtl+avkc9vnOQN7AgJQv4w_+CmBAubXJAODPXQDQkgFgwH0jdYpqfzhoiGpPO4jAf8KqPeSguQHQAP_pY3rh3811APbtAMAK6tNTAYimARDvAdCJE0fa8F5ucN+pNCLcG3yf+ik9Lx38G1PtSb+Ke_QZKFVdwOjzvwA4c4MaQqXYzwAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAP6ADAAQAAAABAAAAGwAAAACIbGP2AAAPT0lEQVRYCeWZ2Y4c53XH_7V2V+8z0+QsXLWQUsTYApxAhg0YyUPlJm+Qx8hlHsBILuK7BAhgIY6NKJGgjeIyQ85wpvel9srvfD0jygKSPIAPWV1d1VXfd5b_Wcf7u7_9+2bezLTk+I8vTvXs9EpH8Vj9MNHl5kx5leonY0+d0NOboqe68fR83pPRyZ2xPE_65Xs5931dFGNVZaXVZMZ7jaarUgd7XT1690h+GCrkmC8uNVtcaDFdajVd6fjOfda5p6LJVarQ1TTTZlvq2bMLrdep3rsltUMpGNyTvEC9lie21LroOx6Wsy9VsdfXL9eKfU8f9kOtslRfnJ2rFVYaxZm2RaPFVvrw8Uf66ZOPVbNT3ZQKgyrUttrqsnqj0l8ralcqak+bItCbi0LrNNVH3VpeS0qzUBXCbzLbXrqcBk74YTJQyTtP00p1LWXeAWuUKvOVvKanXnesMIoUt9rKi1SLFYzFKLJrv912v2f1BgVkaqdrNV6udtIWeoTJjLVrzTepE_72MHLCXy0Lx0MI70ijooRHnzOCplmpKbd7caN+q+FnzxnH91uKwq4C7vhNo_DJe4H2575uzwN1+7nOs6X2wkJtP9CRX7KQr4NbY8VRqF+1UvleI2_UuI1PHg7d+VarD4MN+szEmqoH0na90cvNt7rbPdTHt_cVdjqKR5GuRh1dDg_15sULXW5f6IPDUI+fDGAnQegeCi2wfK6jutJyWmk86oEYX_OqlonxyZEp3NMHo7nbO4rbCNboE9BnCnhxvlQfvXT7fXjdKPIX6nTb2gOBt_ZKHe1fooqN1GwU7vU9ZbmnYuNpGtUq4hKobBDeU9OJlbNxq50oQPjDXq7QrzU4RsXQvfvAAcqWkYPeKM7dtbi9rnPNgoUGUU_7bd7rxooNqTkYzhMVb2ql_lLDZKsxTEk+QrUVYpdNW5p1pSRtNOqauwTy8xrRpdsdAIAakmhn+VY_QOE8F_kgstGbRaE4DhTDRN0EqkDN_tDTnZNYfdbttTIneNMsFf7hi9+qxDerTanFea3LK+l8u1RTFvJC2ynQrWTq_O5fn3cc7AenmBaK__C5caKPT7oq8Lt_f7pxjNQlPsWmZRWpiwDni4X87VbBfKHZbKnpZKmLyRTLp3p1vlL_yxmrLTl84sRa2zzXJU66wuVOv52rAVV5lru1jzVyrvbpVzvLh+2d8Mv5nLdr9XHdDNh_d7bGDRpiTaNiFighjsxar3WWTLRZL0Emwq82S_kpWsf6Jf6CzEq3MJ6XipNSoF9+CeNoe7GJXDyoI5zRaAl8oO0I5CD8EqgboxXMe76vIOZ5Hs1xXsNKgIXyNANpBlFiAgrK80opihdOY5RvC+ICCATCBb9vthmoqlRdC5+mbQf7q9lu77DdckpZznMgjvDdQnVeIIMJDw_Emjxlra35I8gksK5Q8Gq5Vvhg_FhPX2703TRVF+h8NN7T5E6hbVhrfXWuigCVlqEahCtZFNdTfmUABEKDnc__7nIg9tGjD8cq8kYXZ6mz1OXlFKg1Wq9CJXGsJEnQZKSSc11j7XUMpPfVGj9w69nHIs01WdX6_PVWkwmZZJyrn1TqHu87YZ5dEMl+QP_5Yif8atYo9kptI6Drher4Bzo6OdBf_uKJsgUR_2KtGjdu9tpqvX+i_b075k4RNg3Rsq8I+8Zch5HHQUQMiJJYjhCHdjnz0RDtm53s3N1F_axCw3wPiQv2ow9cPNzF3sV47rD3ds_7BDbgZD5OhgAPfOW9a7KgRs4ALT6Hp4DgFhF_Wvi9WRIQwM9bsuca9sxLuCQYY3f2b7C4TyrD7Qi0IlFgQt4P8WL2ijvyOkOFmXp6536s9+91NfFva43Az377RqenG+WLqRpcIWmhGBbM8y0+36j16MTt_hK_NfYf4isFweYffn3pFHBwcMTGpfp3Qw2I9AftEdG60GezlVOgvVx3SGUHQxUwlzeRXrxKdTkp9OL0jFqAuDCbaEtM+LfJIWuFev67b6ghSv3NX8VEcenLUySCup0+a+Kita0tPS2HGDDQXq+lbm+sef9jNa2JktFLZEFx8JmTsotlLcIBKGExW9As7Rt+EcksZSp2FueOnb8newH64S27sHSH2dx995s9Z_93j7uU9P0a9v71fbcWL9jrO3TZl92TVlRZni5xu4oH7JVdrrl+wNbnnh3gkn_wzobuSTtb8rfDBOTuDZk8YTAOCA5jZWlXabJRRSr41S8fKshb+s2nd_VmupCu_kl1ucDnASUw_v1nU9bwdHB4z23airnCTZJHKQ4k9atz6oJYB8OREvLLIskpbMjfm0otAlybIyT6BgEwpq5Ip2c6W4T6boXFRkfk5GOi9UzTfKn5i29wj1rv3k9gNtbTsy9MPJXZrspcTk+Rq9Fev8PdEAQca7w_1F__4mcUT1ShXWJL19T1AB7mmi5nGrRCkNy6VuKNOv7EzuFwcEfLMFYdtJR4QwWkmHk2obJb6uePqbzqrl5_9QRNrzX55iuVpK1utMvzX1+eOXWt+M0QcTqrFIesc+sdd_98Snk5Saka35DmakWUvDc0n041u3qtabqv_z4ryM0rStNcXxP_ChA63dAflCvdPXoMitrUZN_hF6TMJnZoSzeXbqn2o9vcp9A6vwcPpMbNQsnAV3acUm8CWgsNW6A5a7v40OvHmq0rzSbP8XkW9NyiJXU434GQ71UKyJmEAOevEfAEo1wTWa1w8NgNCn0cnGcCrs2twgDgBQjJ+zvvIurygPNa1rZM4CK+W9fW2a1l++EAHOzJupYEbM2QIyB9EZ5cBjApLS5ce7TjwZ7jhuPX9jEebN26oEjDz0Pj3QKR24P9URD1oiI2Ctdf_J5CMFNfOQEv4YWWTsakroTCZU3dXFHeDB7Dd61snSkl1y_LL93GHw3W7nzz8bPbEYJ7uhtMXGFiBYrVtH54R+WaNAQSvFZLXjvWHlVj_2ilVveZ2p2MiE9AI7N4MTzEof784JnqZK5u6xxhfD1rEqee5zPQw7N9UrPRw+R0t_07nHguoHGpi7W+_ceXOj4c6JO_eICU_HYAAFbUHID1gwcnOv7JMamuNHDYggYpDpqZJiW_EmXLjFwNKuqC30mwRWmVWeEsZDtW5Hej2spCO8OQRdo0olzm+cxQxTmgYrtBvK3XsF6B+5SUf4H1Exwl7matqUc6YwmXt2uuzQ0tUJfw5qp7S_SQpVyj661BoV2jYIxUk_NL24Mjp9S1RsgUWHG_Bn0Na3mcw89f_ZeSusNB8xJSEgLv+jurzY0x_IudrVy1FPTN2VeuNH1yuGtonl2iTmj2+qk724eVw69oJG4o2lbqZHtK6OWHWH1JDl9sttQFVzBmlu+p3SVmwGjtBNvV7LMJdQaMO8O4xaz25yozY72l9HkP12h0p5e60vsVCGuoKfLtXDnl9iDoqENRM+wMtPVTjo3GzCWCcqCwNqugLRPOmkbziRptW41utZZVVaZJg1qNpezwGFyYePauvYdnuWvzTc_yMuWw+adVFRXulNM_xAmVZBtUNSlCpjCIRXikzoG8Z40UiLi2qolW4V6214_J9vojslACM1saKNh2PcAutoRYv3GNlKW6Ae5Xs2FNLMvYc0XzFm4vKfAxV+kTEa+bi7eLm+bfUj7Zuhdjq7O5nV7umotIe84VxgEDEdrIyXwER9Tg5ZxostFaF2ro_HoHe9TZaJ_Y4eMpAWE9nZ9j4edvN7n+lmbWJr9F0M0D3aFVl2_v05azp_T8wrRgrrMmNsdq925pQab59OVneu_kvsZP9kAGNX691qvoTBvvSuGIGrcTdDms2dhZ_Gajm_PpBQzii4OE1hBXKImkRnjSzSN8J4qiRMOBocfDx7yoa4BhXT58a2rauEVAQxFh1RQ_B8IevUS8a04MLTuxyBoIbr56Q21GUnZlePyh8D6lr+0d28SGbTZ5jPB0KRbliUEl54gAmhBkG9ybYKEWvPlMqsJHh+_S_DNi4oEso0bH935M__zpv2DNuZ7cxU+IAYvVyj3iN0wHrsnSYpvKyUZgPjHCmGq171KWMrQw38X3vJBmolWr1bFW9VTbzZTvR+r0j4E8cQVXsJTnAU_fz13QvFnffNr2eMH4Chm_p4TRmAk_Tgz2ns7WZBfbG15Ka5hwwX6vrfGtEUGWnEZ1WYX0KIzFnAO5wQM+5yz0_bJvv7x7974ODza6e4v5F8IPVru2Mpjv2Ehr+n2sdEIBYTO+YYklYbQk5zd0ZhUG7o5blKAgjNqgGzOioqBa4f_d3kAdmCtLpi6gy3K95fGiYBJjprymBGva_XuUzEbWyRmNgLfd73k2SpNaS1BDcO0NB6TOnFnBSMe3KIQgH95tKhREoJCa3AlvVZsd_xv9_Kcfu5+6zMIMiqtr4e9eUTdDb8rXCB_oPhNWC5ARvXvO4OAqu5RPnRBl5PYhULsdonkiMces52lOZzccdDXiSBlW5KDOiiD792NarJZOGX929477vbbBBHSn+9Cd7aMCZfPZAqvHOjw6AHUMSpgH3lAAb4QDapgOQGwpTClE2jDR5uL_owDXMLJ3jDYEjxuyfqogOlsvTViA0V1UbTOXS9oorUPOZl5YTBmKkupsxB3g_ze9f0Qc8GwO8CPB8+s0GzGRMY+3cZY9kvDPaEUJfENmmM5eooi5gk8JZ9Vd23WpuyeM75RxeJAUtN5bhRsYaQO7pL9b7Gah_+ts7xit613udRcgNMOiJpCt5IRnZBUTaBIQ4_fp5IaVFvNSG2KGgzjMfS88zJp4PyYrqmosatY0yq7z_CDcc9fLgq7zmmyYcnT7BBRapWejGf3Rmhn8GO8RfESMtcPoGKaY9frtDEijfeDrEQDhSrXN0CnNogGWs+h5TdHE_K3Rg+A9d6eoGFCy4X6HFMgfN5IRTQRQ999ELEP1Fm2AG+tmFnGJzvhdbz9Si2lLywVb_B141gTGiILEonURMAYn8HUot53wjKgt+KcUL0bh_s5N2z0i+DVZ9iEZuzXbhyb6jhoq0ZqYEjLeigJizrDHH2EYiUcnwDGktw4tQsMgMzYPF_DQYsm0tSFotJkX+zB_Q9F0F2weJu9zi3o5t57a14jJjE2o_BFVIkPRfvdIm2qqi_xbnoJJcnfTAEnG4b19Zunjt9kiv7Shpf2xok_aSmjEKJBg1Lo4C5oDAqMNWqYTprmgLDrZCT8c7P5yY7xZbzA5p4ZgDJccv+W3ypkbpozODV2kRBN8FJ3ofwA5Be+ovuTJ4AAAAABJRU5ErkJggg==',
            searchOn: ImageSearchOn.FocusedWindow,
            searchRegion: ImageSearchRegion.TopHalf,
            searchAfterMoveMouseTo: ImageSearchAfterMouseMoveType.MoveToCenter,
        });
    }
}
