<?php

namespace WPaaS\Log\Components;

use \WPaaS\Log\Timer;

if ( ! defined( 'ABSPATH' ) ) {

	exit;

}

final class BeaverBuilder extends Component {

	use Post_Helper;

	/**
	 * Make sure callbacks are added only if Beaver Builder is active
	 */
	protected function do_callbacks_on_hooks() {

		if ( class_exists( 'FLBuilder' ) ) {

			parent::do_callbacks_on_hooks();

		}

	}

	/**
	 * Get post from beaver builder post data
	 *
	 * @return bool
	 */
	private function get_post() {

		if ( ! isset( $_POST['fl_builder_data']['post_id'] ) ) {

			return false;

		}

		$post = get_post( absint( $_POST['fl_builder_data']['post_id'] ) );

		if ( empty( $post ) ) {

			return false;

		}

		// We have a post we can stop timer right away
		Timer::stop();

		return $post;

	}

	/**
	 * Fires when Beaver Builder Save & Exit button is clicked
	 *
	 * @action fl_ajax_before_save_draft
	 */
	public function callback_fl_ajax_before_save_draft() {

		if ( ! $post = $this->get_post() ) {

			return;

		}

		$summary = __(
			'Beaver Builder %2$s "%1$s" Drafted',
			'gd-system-plugin'
		);

		call_user_func_array( [ $this, 'log' ], $this->create_post_log_args( 'draft', $summary, $post ) );

	}

	/**
	 * Fires when Beaver Builder Discard & Exit button is clicked
	 *
	 * @action fl_ajax_before_clear_draft_layout
	 */
	public function callback_fl_ajax_before_clear_draft_layout() {

		if ( ! $post = $this->get_post() ) {

			return;

		}

		$summary = __(
			'Beaver Builder %2$s "%1$s" Discarded',
			'gd-system-plugin'
		);

		call_user_func_array( [ $this, 'log' ], $this->create_post_log_args( 'discard', $summary, $post ) );

	}

}
