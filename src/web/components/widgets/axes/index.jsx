import _, { includes } from 'lodash';
import classNames from 'classnames';
import pubsub from 'pubsub-js';
import React, { Component, PropTypes } from 'react';
import i18n from '../../../lib/i18n';
import { in2mm, mm2in } from '../../../lib/units';
import controller from '../../../lib/controller';
import store from '../../../store';
import Widget from '../../widget';
import Axes from './Axes';
import { show as showSettings } from './Settings';
import {
    IMPERIAL_UNITS,
    METRIC_UNITS,
    GRBL,
    TINYG2,
    GRBL_ACTIVE_STATE_IDLE,
    GRBL_ACTIVE_STATE_RUN,
    TINYG2_MACHINE_STATE_READY,
    TINYG2_MACHINE_STATE_STOP,
    TINYG2_MACHINE_STATE_END,
    TINYG2_MACHINE_STATE_RUN,
    WORKFLOW_STATE_IDLE
} from '../../../constants';
import {
    DISTANCE_MIN,
    DISTANCE_MAX,
    DISTANCE_STEP
} from './constants';
import './index.styl';

const toFixedUnits = (units, val) => {
    val = Number(val) || 0;
    if (units === IMPERIAL_UNITS) {
        val = mm2in(val).toFixed(4);
    }
    if (units === METRIC_UNITS) {
        val = val.toFixed(3);
    }

    return val;
};

const toUnits = (units, val) => {
    val = Number(val) || 0;
    if (units === IMPERIAL_UNITS) {
        val = mm2in(val).toFixed(4) * 1;
    }
    if (units === METRIC_UNITS) {
        val = val.toFixed(3) * 1;
    }

    return val;
};

const normalizeToRange = (n, min, max) => {
    if (n < min) {
        return min;
    }
    if (n > max) {
        return max;
    }
    return n;
};

class AxesWidget extends Component {
    static propTypes = {
        onDelete: PropTypes.func
    };
    static defaultProps = {
        onDelete: () => {}
    };

    controllerEvents = {
        'Grbl:state': (state) => {
            const { status, parserstate } = { ...state };
            const { machinePosition, workPosition } = status;
            const { modal = {} } = { ...parserstate };
            let units = this.state.units;
            let customDistance = store.get('widgets.axes.jog.customDistance');

            // Imperial
            if (modal.units === 'G20') {
                units = IMPERIAL_UNITS;
                customDistance = mm2in(customDistance).toFixed(4) * 1;
            }

            // Metric
            if (modal.units === 'G21') {
                units = METRIC_UNITS;
                customDistance = Number(customDistance).toFixed(3) * 1;
            }

            this.setState({
                units: units,
                controller: {
                    type: GRBL,
                    state: state
                },
                machinePosition: machinePosition,
                workPosition: workPosition,
                customDistance: customDistance
            });
        },
        'TinyG2:state': (state) => {
            const { sr } = { ...state };
            const { machinePosition, workPosition, modal = {} } = sr;
            let units = this.state.units;
            let customDistance = store.get('widgets.axes.jog.customDistance');

            // Imperial
            if (modal.units === 'G20') {
                units = IMPERIAL_UNITS;
                customDistance = mm2in(customDistance).toFixed(4) * 1;
            }

            // Metric
            if (modal.units === 'G21') {
                units = METRIC_UNITS;
                customDistance = Number(customDistance).toFixed(3) * 1;
            }

            this.setState({
                units: units,
                controller: {
                    type: TINYG2,
                    state: state
                },
                machinePosition: machinePosition,
                workPosition: workPosition,
                customDistance: customDistance
            });
        }
    };
    pubsubTokens = [];

    constructor() {
        super();
        this.state = this.getDefaultState();
    }
    componentDidMount() {
        this.subscribe();
        this.addControllerEvents();
    }
    componentWillUnmount() {
        this.unsubscribe();
        this.removeControllerEvents();
    }
    shouldComponentUpdate(nextProps, nextState) {
        return !_.isEqual(nextProps, this.props) || !_.isEqual(nextState, this.state);
    }
    componentDidUpdate(prevProps, prevState) {
        // The custom distance will not persist to store while toggling between in and mm
        if ((prevState.customDistance !== this.state.customDistance) &&
            (prevState.units === this.state.units)) {
            let customDistance = this.state.customDistance;
            if (this.state.units === IMPERIAL_UNITS) {
                customDistance = in2mm(customDistance);
            }
            // To save in mm
            store.set('widgets.axes.jog.customDistance', Number(customDistance));
        }

        if (prevState.selectedDistance !== this.state.selectedDistance) {
            // '1', '0.1', '0.01', '0.001' or ''
            store.set('widgets.axes.jog.selectedDistance', this.state.selectedDistance);
        }

        if (prevState.keypadJogging !== this.state.keypadJogging) {
            store.set('widgets.axes.jog.keypad', this.state.keypadJogging);
        }
    }
    getDefaultState() {
        return {
            isCollapsed: false,
            isFullscreen: false,
            canClick: true, // Defaults to true
            port: controller.port,
            units: METRIC_UNITS,
            controller: {
                type: controller.type,
                state: controller.state
            },
            workflowState: controller.workflowState,
            machinePosition: { // Machine position
                x: '0.000',
                y: '0.000',
                z: '0.000'
            },
            workPosition: { // Work position
                x: '0.000',
                y: '0.000',
                z: '0.000'
            },
            keypadJogging: store.get('widgets.axes.jog.keypad'),
            selectedAxis: '', // Defaults to empty
            selectedDistance: store.get('widgets.axes.jog.selectedDistance'),
            customDistance: toUnits(METRIC_UNITS, store.get('widgets.axes.jog.customDistance'))
        };
    }
    subscribe() {
        const tokens = [
            pubsub.subscribe('port', (msg, port) => {
                port = port || '';

                if (port) {
                    this.setState({ port: port });
                } else {
                    const defaultState = this.getDefaultState();
                    this.setState({
                        ...defaultState,
                        port: ''
                    });
                }
            }),
            pubsub.subscribe('workflowState', (msg, workflowState) => {
                if (this.state.workflowState !== workflowState) {
                    const { keypadJogging, selectedAxis } = this.state;

                    // Disable keypad jogging and shuttle wheel when the workflow is not in the idle state.
                    // This prevents accidental movement while sending G-code commands.
                    this.setState({
                        keypadJogging: (workflowState === WORKFLOW_STATE_IDLE) ? keypadJogging : false,
                        selectedAxis: (workflowState === WORKFLOW_STATE_IDLE) ? selectedAxis : '',
                        workflowState: workflowState
                    });
                }
            })
        ];
        this.pubsubTokens = this.pubsubTokens.concat(tokens);
    }
    unsubscribe() {
        _.each(this.pubsubTokens, (token) => {
            pubsub.unsubscribe(token);
        });
        this.pubsubTokens = [];
    }
    addControllerEvents() {
        _.each(this.controllerEvents, (callback, eventName) => {
            controller.on(eventName, callback);
        });
    }
    removeControllerEvents() {
        _.each(this.controllerEvents, (callback, eventName) => {
            controller.off(eventName, callback);
        });
    }
    canClick() {
        const { port, workflowState } = this.state;
        const controllerType = this.state.controller.type;
        const controllerState = this.state.controller.state;

        if (!port) {
            return false;
        }
        if (workflowState !== WORKFLOW_STATE_IDLE) {
            return false;
        }
        if (!includes([GRBL, TINYG2], controllerType)) {
            return false;
        }
        if (controllerType === GRBL) {
            const activeState = _.get(controllerState, 'status.activeState');
            const states = [
                GRBL_ACTIVE_STATE_IDLE,
                GRBL_ACTIVE_STATE_RUN
            ];
            if (!includes(states, activeState)) {
                return false;
            }
        }
        if (controllerType === TINYG2) {
            const machineState = _.get(controllerState, 'sr.machineState');
            const states = [
                TINYG2_MACHINE_STATE_READY,
                TINYG2_MACHINE_STATE_STOP,
                TINYG2_MACHINE_STATE_END,
                TINYG2_MACHINE_STATE_RUN
            ];
            if (!includes(states, machineState)) {
                return false;
            }
        }

        return true;
    }
    toggleDisplayUnits() {
        const { units } = this.state;

        if (units === METRIC_UNITS) {
            controller.command('gcode', 'G20'); // G20 specifies Imperial units
        } else {
            controller.command('gcode', 'G21'); // G21 specifies Metric units
        }
    }
    toggleKeypadJogging() {
        this.setState({ keypadJogging: !this.state.keypadJogging });
    }
    selectAxis(axis = '') {
        this.setState({ selectedAxis: axis });
    }
    selectDistance(distance = '') {
        this.setState({ selectedDistance: distance });
    }
    changeCustomDistance(customDistance) {
        customDistance = normalizeToRange(customDistance, DISTANCE_MIN, DISTANCE_MAX);
        this.setState({ customDistance: customDistance });
    }
    increaseCustomDistance() {
        const { units, customDistance } = this.state;
        let distance = Math.min(Number(customDistance) + DISTANCE_STEP, DISTANCE_MAX);
        if (units === IMPERIAL_UNITS) {
            distance = distance.toFixed(4) * 1;
        }
        if (units === METRIC_UNITS) {
            distance = distance.toFixed(3) * 1;
        }
        this.setState({ customDistance: distance });
    }
    decreaseCustomDistance() {
        const { units, customDistance } = this.state;
        let distance = Math.max(Number(customDistance) - DISTANCE_STEP, DISTANCE_MIN);
        if (units === IMPERIAL_UNITS) {
            distance = distance.toFixed(4) * 1;
        }
        if (units === METRIC_UNITS) {
            distance = distance.toFixed(3) * 1;
        }
        this.setState({ customDistance: distance });
    }
    render() {
        const { isCollapsed, isFullscreen } = this.state;
        const { units, machinePosition, workPosition } = this.state;
        const classes = {
            widgetContent: classNames(
                { hidden: isCollapsed }
            )
        };

        const state = {
            ...this.state,
            // Determine if the motion button is clickable
            canClick: this.canClick(),
            // Output machine position with the display units
            machinePosition: _.mapValues(machinePosition, (pos, axis) => {
                return String(toFixedUnits(units, pos));
            }),
            // Output work position with the display units
            workPosition: _.mapValues(workPosition, (pos, axis) => {
                return String(toFixedUnits(units, pos));
            })
        };
        const actions = {
            toggleDisplayUnits: ::this.toggleDisplayUnits,
            toggleKeypadJogging: ::this.toggleKeypadJogging,
            selectAxis: ::this.selectAxis,
            selectDistance: ::this.selectDistance,
            changeCustomDistance: ::this.changeCustomDistance,
            increaseCustomDistance: ::this.increaseCustomDistance,
            decreaseCustomDistance: ::this.decreaseCustomDistance
        };

        return (
            <div {...this.props} data-ns="widgets/axes">
                <Widget fullscreen={isFullscreen}>
                    <Widget.Header>
                        <Widget.Title>{i18n._('Axes')}</Widget.Title>
                        <Widget.Controls>
                            <Widget.Button
                                type="edit"
                                onClick={(event) => {
                                    showSettings();
                                }}
                            />
                            <Widget.Button
                                type="toggle"
                                defaultValue={isCollapsed}
                                onClick={(event, val) => this.setState({ isCollapsed: !!val })}
                            />
                            <Widget.Button
                                type="fullscreen"
                                defaultValue={isFullscreen}
                                onClick={(event, val) => this.setState({ isFullscreen: !!val })}
                            />
                            <Widget.Button
                                type="delete"
                                onClick={(event) => this.props.onDelete()}
                            />
                        </Widget.Controls>
                    </Widget.Header>
                    <Widget.Content className={classes.widgetContent}>
                        <Axes
                            state={state}
                            actions={actions}
                        />
                    </Widget.Content>
                </Widget>
            </div>
        );
    }
}

export default AxesWidget;
